import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button, Panel } from '../components/Basics';
import { ConfirmDialog } from '../components/Overlays';
import { useReducedMotion, useT, useUi } from '../context';
import { useEntrance, useNavScope, type ElementRef } from '../hooks';
import { logoShardOffset, play } from '../motion';
import { SettingsScreen } from './SettingsScreen';

export type PauseAction = 'resume' | 'restart' | 'perf' | 'quit';

/** Settings as a pop-up that rises from the control that opened it (spec 8.4). */
function useSettingsPopup(): {
  readonly open: (from: EventTarget | null) => void;
  readonly view: JSX.Element | null;
} {
  const { settings, about } = useUi();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [isOpen, setOpen] = useState(false);
  const open = (from: EventTarget | null): void => {
    const rect = from instanceof Element ? from.getBoundingClientRect() : null;
    setOrigin(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null);
    setOpen(true);
  };
  const view =
    isOpen && settings ? (
      <SettingsScreen
        store={settings}
        about={about}
        origin={origin ?? undefined}
        onClose={() => {
          setOpen(false);
        }}
      />
    ) : null;
  return { open, view };
}

/** The logo: letters that fly together from scattered shard offsets (1.2 s); a fade under reduced motion. */
export function Logo(props: { readonly text: string }): JSX.Element {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const letters = Array.from(props.text);
  useLayoutEffect(() => {
    const spans = ref.current?.querySelectorAll<HTMLElement>('.cd-logo-letter') ?? [];
    spans.forEach((el, index) => {
      const o = logoShardOffset(index);
      el.style.setProperty('--dx', `${String(o.dx)}px`);
      el.style.setProperty('--dy', `${String(o.dy)}px`);
      el.style.setProperty('--rot', `${String(o.rot)}deg`);
      play(el, 'logoAssemble', reduced, { index });
    });
    // The assembly plays once per mount.
  }, []);
  return (
    <h1 ref={ref} class="cd-display cd-logo" aria-label={props.text}>
      {letters.map((letter, i) => (
        <span key={i} class="cd-logo-letter" aria-hidden="true">
          {letter === ' ' ? '\u00a0' : letter}
        </span>
      ))}
    </h1>
  );
}

export interface TitleScreenProps {
  readonly version: string;
  readonly onStart: () => void;
  /** Gallery previews render without taking focus or registering navigation. */
  readonly preview?: boolean;
}

/** Title (spec 8.5, 2A scope): the logo, "Tap to start", and the version. */
export function TitleScreen(props: TitleScreenProps): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const preview = props.preview === true;
  const settings = useSettingsPopup();
  const t = useT();
  const start = (): void => {
    if (started.current || preview) return;
    started.current = true;
    props.onStart();
  };
  return (
    <div ref={root} class="cd-screen" data-role="title" onClick={start} style={{ gap: 'var(--space-6)' }}>
      {preview ? null : <NavScopeFor root={root} />}
      <Logo text={t('title.logo')} />
      <Button variant="primary" size="large" autofocus data-action="start" onClick={start}>
        {t('title.start')}
      </Button>
      <span class="cd-version" data-role="version">
        {t('title.version', { version: props.version })}
      </span>
      <div class="cd-gear">
        <Button
          variant="icon"
          label={t('title.settings')}
          data-action="settings"
          onClick={(event) => {
            event.stopPropagation();
            settings.open(event.currentTarget);
          }}
        >
          <GearIcon />
        </Button>
      </div>
      {settings.view ? (
        <div
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {settings.view}
        </div>
      ) : null}
    </div>
  );
}

/** Registers a navigation scope for an existing element (a component with no markup of its own). */
function NavScopeFor(props: { readonly root: ElementRef<HTMLElement>; readonly onBack?: () => void }): null {
  useNavScope(props.root, { onBack: props.onBack });
  return null;
}

export interface NoticeScreenProps {
  readonly onContinue: () => void;
  readonly preview?: boolean;
}

/** Photosensitivity notice (spec 8.12): shown on the first launch, before the Title. */
export function PhotosensitivityNotice(props: NoticeScreenProps): JSX.Element {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEntrance(panel, 'panelOpen');
  return (
    <div ref={root} class="cd-screen" data-role="photosensitivity-notice">
      {props.preview === true ? null : <NavScopeFor root={root} />}
      <div
        ref={panel}
        class="cd-panel cd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        aria-describedby="notice-body"
      >
        <h1 class="cd-title" id="notice-title">
          {t('notice.title')}
        </h1>
        <div id="notice-body" class="cd-stack">
          <p class="cd-body">{t('notice.body')}</p>
          <p class="cd-caption">{t('notice.detail')}</p>
        </div>
        <Button variant="primary" size="large" autofocus data-action="continue" onClick={props.onContinue}>
          {t('notice.continue')}
        </Button>
      </div>
    </div>
  );
}

export interface PauseScreenProps {
  readonly perfShown: boolean;
  /** Unbanked shards the quit warning mentions. */
  readonly carriedShards: number;
  readonly onAction: (action: PauseAction) => void;
  readonly preview?: boolean;
}

/** Pause (spec 8.5, 2A scope): Resume, Restart level, the dev performance overlay, Quit to title. */
export function PauseScreen(props: PauseScreenProps): JSX.Element {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const settings = useSettingsPopup();
  const done = useRef(false);
  useEntrance(panel, 'panelOpen');
  const act = (action: PauseAction): void => {
    // A key press and a click in the same frame act once; the overlay toggle may repeat.
    if (action !== 'perf') {
      if (done.current) return;
      done.current = true;
    }
    props.onAction(action);
  };
  const preview = props.preview === true;
  return (
    <div
      ref={root}
      class="cd-screen"
      data-role="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('pause.title')}
    >
      <div class="cd-backdrop" aria-hidden="true" />
      {preview ? null : <NavScopeFor root={root} />}
      <Panel class="cd-modal">
        <div ref={panel} class="cd-stack">
          <h1 class="cd-title">{t('pause.title')}</h1>
          <Button
            align="start"
            data-action="resume"
            autofocus
            onClick={() => {
              act('resume');
            }}
          >
            {t('pause.resume')}
          </Button>
          <Button
            align="start"
            data-action="restart"
            onClick={() => {
              act('restart');
            }}
          >
            {t('pause.restart')}
          </Button>
          <Button
            align="start"
            data-action="settings"
            onClick={(event) => {
              settings.open(event.currentTarget);
            }}
          >
            {t('pause.settings')}
          </Button>
          <Button
            align="start"
            data-action="perf"
            onClick={() => {
              act('perf');
            }}
          >
            {t('pause.perf', { state: t(props.perfShown ? 'common.on' : 'common.off') })}
          </Button>
          <Button
            align="start"
            data-action="quit"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('pause.quit')}
          </Button>
          <p class="cd-caption">{t('pause.hint')}</p>
        </div>
      </Panel>
      {confirming ? (
        <ConfirmDialog
          title={t('pause.quitTitle')}
          message={
            props.carriedShards > 0
              ? t('pause.quitCarrying', { count: props.carriedShards })
              : t('pause.quitPlain')
          }
          confirmLabel={t('pause.quitConfirm')}
          danger
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            act('quit');
          }}
        />
      ) : null}
      {settings.view}
    </div>
  );
}

/** A simple gear (decorative: the button carries the label). */
function GearIcon(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.3 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.3 2.7h4l.3-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  );
}
