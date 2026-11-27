import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Button, Panel } from '../components/Basics';
import { ConfirmDialog } from '../components/Overlays';
import { useReducedMotion } from '../context';
import { useEntrance, useNavScope, type ElementRef } from '../hooks';
import { logoShardOffset, play } from '../motion';

export type PauseAction = 'resume' | 'restart' | 'perf' | 'quit';

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
  const start = (): void => {
    if (started.current || preview) return;
    started.current = true;
    props.onStart();
  };
  return (
    <div ref={root} class="cd-screen" data-role="title" onClick={start} style={{ gap: 'var(--space-6)' }}>
      {preview ? null : <NavScopeFor root={root} />}
      <Logo text="COSMIC DRIFT" />
      <Button variant="primary" size="large" autofocus data-action="start" onClick={start}>
        Tap to start
      </Button>
      <span class="cd-version" data-role="version">
        v{props.version}
      </span>
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
          Photosensitivity notice
        </h1>
        <div id="notice-body" class="cd-stack">
          <p class="cd-body">
            Cosmic Drift has bright effects, camera shake, and fast movement. Some people can have seizures or
            discomfort from flashing lights. If that includes you, or you feel unwell while playing, stop and
            talk to a doctor.
          </p>
          <p class="cd-caption">
            Nothing in the game flashes more than three times per second. Screen flashes start at Reduced, and
            animations follow your device&apos;s reduced-motion setting.
          </p>
        </div>
        <Button variant="primary" size="large" autofocus data-action="continue" onClick={props.onContinue}>
          Continue
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
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
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
      aria-label="Paused"
    >
      <div class="cd-backdrop" aria-hidden="true" />
      {preview ? null : <NavScopeFor root={root} />}
      <Panel class="cd-modal">
        <div ref={panel} class="cd-stack">
          <h1 class="cd-title">Paused</h1>
          <Button
            align="start"
            data-action="resume"
            autofocus
            onClick={() => {
              act('resume');
            }}
          >
            Resume
          </Button>
          <Button
            align="start"
            data-action="restart"
            onClick={() => {
              act('restart');
            }}
          >
            Restart level
          </Button>
          <Button
            align="start"
            data-action="perf"
            onClick={() => {
              act('perf');
            }}
          >
            {`Performance overlay: ${props.perfShown ? 'On' : 'Off'}`}
          </Button>
          <Button
            align="start"
            data-action="quit"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Quit to title
          </Button>
          <p class="cd-caption">Esc, P, or Start to resume</p>
        </div>
      </Panel>
      {confirming ? (
        <ConfirmDialog
          title="Quit to title?"
          message={
            props.carriedShards > 0
              ? `You are carrying ${String(props.carriedShards)} unbanked shards. Quitting loses them and this level's progress.`
              : "Quitting loses this level's progress."
          }
          confirmLabel="Quit"
          danger
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            act('quit');
          }}
        />
      ) : null}
    </div>
  );
}
