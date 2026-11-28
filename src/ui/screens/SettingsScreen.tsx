import type { ComponentChildren, JSX } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Settings, SettingsTab } from '../../settings/SettingsSchema';
import type { SettingsStore } from '../../settings/SettingsStore';
import { Button, Segmented, Toggle } from '../components/Basics';
import { Slider, Tabs } from '../components/Inputs';
import { useReducedMotion, useT, useUi } from '../context';
import { useNavScope } from '../hooks';
import { play } from '../motion';
import { useStore } from '../store';

/**
 * Settings (spec 8.6): every tab and row of the table. Changes apply live and persist at once. Rows for
 * systems that are not built yet still store the choice and say when it takes effect.
 */

type Tab = SettingsTab | 'about';

const TAB_KEYS: Readonly<Record<Tab, string>> = {
  audio: 'settings.tab.audio',
  graphics: 'settings.tab.graphics',
  controls: 'settings.tab.controls',
  gameplay: 'settings.tab.gameplay',
  accessibility: 'settings.tab.accessibility',
  language: 'settings.tab.language',
  data: 'settings.tab.data',
  about: 'settings.tab.about',
};

export interface AboutInfo {
  readonly version: string;
  readonly build: string;
}

export interface SettingsScreenProps {
  readonly store: SettingsStore;
  readonly about: AboutInfo;
  readonly onClose: () => void;
  /** Where the pop-up rises from (the gear icon), in client pixels. */
  readonly origin?: { readonly x: number; readonly y: number } | undefined;
  readonly initialTab?: Tab;
}

function Row(props: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly children?: ComponentChildren;
  readonly wide?: boolean;
}): JSX.Element {
  const hintId = useId();
  return (
    <div
      class="cd-setting"
      role="group"
      aria-label={props.label}
      aria-describedby={props.hint ? hintId : undefined}
    >
      <div class="cd-setting-text">
        <span class="cd-setting-label">{props.label}</span>
        {props.hint ? (
          <span class="cd-caption" id={hintId}>
            {props.hint}
          </span>
        ) : null}
      </div>
      <div class={props.wide === true ? 'cd-setting-control cd-setting-wide' : 'cd-setting-control'}>
        {props.children}
      </div>
    </div>
  );
}

/** A segmented control over a nullable value: `null` shows as the "follow" option. */
function choice<const T extends string>(
  options: readonly (readonly [T, string])[],
): readonly { readonly value: T; readonly label: string }[] {
  return options.map(([value, label]) => ({ value, label }));
}

const PRESET = 'preset';

function AudioTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const pctFmt = (v: number): string => `${String(v)}%`;
  const vol = (
    key: 'master' | 'music' | 'sfx' | 'ui' | 'voice',
    label: string,
    hint?: string,
  ): JSX.Element => (
    <Row label={label} hint={hint} wide>
      <Slider
        label={label}
        value={s.audio[key]}
        min={0}
        max={100}
        format={pctFmt}
        onChange={(v) => store.set('audio', key, v)}
      />
    </Row>
  );
  return (
    <>
      {vol('master', t('settings.audio.master'))}
      {vol('music', t('settings.audio.music'), t('settings.audio.musicHint'))}
      {vol('sfx', t('settings.audio.sfx'))}
      {vol('ui', t('settings.audio.ui'))}
      {vol('voice', t('settings.audio.voice'), t('settings.audio.voiceHint'))}
      <Row label={t('settings.audio.muteInBackground')}>
        <Toggle
          label={t('settings.audio.muteInBackground')}
          checked={s.audio.muteInBackground}
          onChange={(v) => store.set('audio', 'muteInBackground', v)}
        />
      </Row>
      <Row label={t('settings.audio.mono')}>
        <Toggle
          label={t('settings.audio.mono')}
          checked={s.audio.mono}
          onChange={(v) => store.set('audio', 'mono', v)}
        />
      </Row>
      <Row label={t('settings.audio.dynamicRange')} hint={t('settings.audio.dynamicRangeHint')}>
        <Segmented
          label={t('settings.audio.dynamicRange')}
          value={s.audio.dynamicRange}
          onChange={(v) => store.set('audio', 'dynamicRange', v)}
          options={choice([
            ['full', t('settings.audio.full')],
            ['night', t('settings.audio.night')],
          ])}
        />
      </Row>
    </>
  );
}

function GraphicsTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const g = s.graphics;
  return (
    <>
      <Row label={t('settings.graphics.preset')} hint={t('settings.nextStart')}>
        <Segmented
          label={t('settings.graphics.preset')}
          value={g.preset}
          onChange={(v) => store.set('graphics', 'preset', v)}
          options={choice([
            ['auto', t('settings.graphics.auto')],
            ['battery', t('settings.graphics.battery')],
            ['balanced', t('settings.graphics.balanced')],
            ['high', t('settings.graphics.high')],
          ])}
        />
      </Row>
      <Row label={t('settings.graphics.fpsCap')}>
        <Segmented
          label={t('settings.graphics.fpsCap')}
          value={g.fpsCap}
          onChange={(v) => store.set('graphics', 'fpsCap', v)}
          options={choice([
            ['30', '30'],
            ['60', '60'],
            ['max', t('settings.graphics.displayMax')],
          ])}
        />
      </Row>
      <Row
        label={t('settings.graphics.renderScale')}
        hint={
          g.renderScale === null
            ? t('settings.graphics.renderScaleHintFollow')
            : t('settings.graphics.renderScaleHint')
        }
        wide
      >
        <div class="cd-row">
          <Toggle
            label={t('settings.graphics.renderScaleFollow')}
            checked={g.renderScale === null}
            onChange={(follow) => store.set('graphics', 'renderScale', follow ? null : 100)}
          />
          {g.renderScale === null ? null : (
            <Slider
              label={t('settings.graphics.renderScale')}
              value={g.renderScale}
              min={70}
              max={100}
              format={(v) => `${String(v)}%`}
              onChange={(v) => store.set('graphics', 'renderScale', v)}
            />
          )}
        </div>
      </Row>
      <Row label={t('settings.graphics.particles')} hint={t('settings.nextStart')}>
        <Segmented<typeof PRESET | 'low' | 'medium' | 'high'>
          label={t('settings.graphics.particles')}
          value={g.particles ?? PRESET}
          onChange={(v) => store.set('graphics', 'particles', v === PRESET ? null : v)}
          options={choice([
            [PRESET, t('settings.preset')],
            ['low', t('settings.graphics.low')],
            ['medium', t('settings.graphics.medium')],
            ['high', t('settings.graphics.high')],
          ])}
        />
      </Row>
      <Row label={t('settings.graphics.postEffects')} hint={t('settings.graphics.postEffectsHint')}>
        <Segmented
          label={t('settings.graphics.postEffects')}
          value={g.postEffects === null ? PRESET : g.postEffects ? 'on' : 'off'}
          onChange={(v) => store.set('graphics', 'postEffects', v === PRESET ? null : v === 'on')}
          options={choice([
            [PRESET, t('settings.preset')],
            ['on', t('common.on')],
            ['off', t('common.off')],
          ])}
        />
      </Row>
      <Row label={t('settings.graphics.parallax')} hint={t('settings.nextStart')}>
        <Segmented
          label={t('settings.graphics.parallax')}
          value={g.parallaxLayers === null ? PRESET : String(g.parallaxLayers)}
          onChange={(v) => store.set('graphics', 'parallaxLayers', v === PRESET ? null : v === '3' ? 3 : 5)}
          options={choice([
            [PRESET, t('settings.preset')],
            ['3', '3'],
            ['5', '5'],
          ])}
        />
      </Row>
      <Row
        label={t('settings.graphics.menuBackground')}
        hint={g.menuBackground === 'planet' ? t('settings.graphics.planetHint') : undefined}
      >
        <Segmented
          label={t('settings.graphics.menuBackground')}
          value={g.menuBackground}
          onChange={(v) => store.set('graphics', 'menuBackground', v)}
          options={choice([
            ['animated', t('settings.graphics.animated')],
            ['static', t('settings.graphics.static')],
            ['planet', t('settings.graphics.planet')],
          ])}
        />
      </Row>
      <Row label={t('settings.graphics.intensity')} wide>
        <Slider
          label={t('settings.graphics.intensity')}
          value={g.backgroundIntensity}
          min={0}
          max={100}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('graphics', 'backgroundIntensity', v)}
        />
      </Row>
      <Row label={t('settings.graphics.showFps')}>
        <Toggle
          label={t('settings.graphics.showFps')}
          checked={g.showFps}
          onChange={(v) => store.set('graphics', 'showFps', v)}
        />
      </Row>
    </>
  );
}

function ControlsTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const c = s.controls;
  return (
    <>
      <Row label={t('settings.controls.layoutPreset')} hint={t('settings.controls.layoutPresetHint')}>
        <Segmented
          label={t('settings.controls.layoutPreset')}
          value={c.layoutPreset}
          onChange={(v) => store.set('controls', 'layoutPreset', v)}
          options={choice([
            ['classic', t('settings.controls.classic')],
            ['simple', t('settings.controls.simple')],
            ['leftHanded', t('settings.controls.leftHanded')],
          ])}
        />
      </Row>
      <Row label={t('settings.controls.editLayout')}>
        <Button disabled disabledReason={t('settings.controls.editLayoutLater')}>
          {t('settings.controls.editLayout')}
        </Button>
      </Row>
      <Row label={t('settings.controls.stickType')}>
        <Segmented
          label={t('settings.controls.stickType')}
          value={c.stickType}
          onChange={(v) => store.set('controls', 'stickType', v)}
          options={choice([
            ['floating', t('settings.controls.floating')],
            ['fixed', t('settings.controls.fixed')],
          ])}
        />
      </Row>
      <Row label={t('settings.controls.buttonSize')} wide>
        <Slider
          label={t('settings.controls.buttonSize')}
          value={c.buttonSize}
          min={75}
          max={150}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'buttonSize', v)}
        />
      </Row>
      <Row label={t('settings.controls.buttonOpacity')} wide>
        <Slider
          label={t('settings.controls.buttonOpacity')}
          value={c.buttonOpacity}
          min={30}
          max={100}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'buttonOpacity', v)}
        />
      </Row>
      <Row label={t('settings.controls.deadzone')} wide>
        <Slider
          label={t('settings.controls.deadzone')}
          value={c.deadzone}
          min={5}
          max={30}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'deadzone', v)}
        />
      </Row>
      <Row label={t('settings.controls.saturation')} wide>
        <Slider
          label={t('settings.controls.saturation')}
          value={c.saturation}
          min={70}
          max={98}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'saturation', v)}
        />
      </Row>
      <Row label={t('settings.controls.curve')} hint={t('settings.controls.curveHint')} wide>
        <Slider
          label={t('settings.controls.curve')}
          value={c.curve}
          min={10}
          max={25}
          format={(v) => (v / 10).toFixed(1)}
          onChange={(v) => store.set('controls', 'curve', v)}
        />
      </Row>
      <Row
        label={t('settings.controls.aimMode')}
        hint={
          c.aimMode === 'assisted'
            ? t('settings.controls.aimAssistedHint')
            : t('settings.controls.aimDefaultHint')
        }
      >
        <Segmented
          label={t('settings.controls.aimMode')}
          value={c.aimMode ?? 'device'}
          onChange={(v) => store.set('controls', 'aimMode', v === 'device' ? null : v)}
          options={choice([
            ['device', t('settings.controls.aimDefault')],
            ['auto', t('settings.controls.aimAuto')],
            ['assisted', t('settings.controls.aimAssisted')],
            ['manual', t('settings.controls.aimManual')],
          ])}
        />
      </Row>
      <Row label={t('settings.controls.shoot')} hint={t('settings.controls.shootHint')}>
        <Segmented
          label={t('settings.controls.shoot')}
          value={c.shoot}
          onChange={(v) => store.set('controls', 'shoot', v)}
          options={choice([
            ['hold', t('settings.controls.hold')],
            ['toggle', t('settings.controls.toggle')],
          ])}
        />
      </Row>
      <Row label={t('settings.controls.haptics')} hint={t('settings.controls.hapticsHint')}>
        <Segmented
          label={t('settings.controls.haptics')}
          value={c.haptics}
          onChange={(v) => store.set('controls', 'haptics', v)}
          options={choice([
            ['off', t('common.off')],
            ['light', t('settings.controls.light')],
            ['full', t('settings.audio.full')],
          ])}
        />
      </Row>
      <Row label={t('settings.controls.bindings')}>
        <Button disabled disabledReason={t('settings.controls.rebindLater')}>
          {t('settings.controls.rebind')}
        </Button>
      </Row>
    </>
  );
}

function GameplayTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const g = s.gameplay;
  const restart = t('settings.nextRestart');
  const toggle = (
    key:
      | 'invulnerable'
      | 'infiniteFuel'
      | 'autoFire'
      | 'bossCheckpoints'
      | 'hazardNoDamage'
      | 'hitStop'
      | 'damageNumbers'
      | 'tutorialHints',
    label: string,
    hint?: string,
  ): JSX.Element => (
    <Row label={label} hint={hint}>
      <Toggle label={label} checked={g[key]} onChange={(v) => store.set('gameplay', key, v)} />
    </Row>
  );
  return (
    <>
      <Row
        label={t('settings.gameplay.difficulty')}
        hint={g.difficulty === 'drift_plus' ? t('settings.gameplay.driftHint') : restart}
      >
        <Segmented
          label={t('settings.gameplay.difficulty')}
          value={g.difficulty}
          onChange={(v) => store.set('gameplay', 'difficulty', v)}
          options={choice([
            ['easy', t('settings.gameplay.easy')],
            ['normal', t('settings.gameplay.normal')],
            ['hard', t('settings.gameplay.hard')],
            ['drift_plus', t('settings.gameplay.driftPlus')],
          ])}
        />
      </Row>
      <h3 class="cd-setting-heading">{t('settings.gameplay.assists')}</h3>
      {toggle('invulnerable', t('settings.gameplay.invulnerable'), restart)}
      {toggle('infiniteFuel', t('settings.gameplay.infiniteFuel'), restart)}
      <Row label={t('settings.gameplay.gameSpeed')}>
        <Segmented
          label={t('settings.gameplay.gameSpeed')}
          value={String(g.gameSpeed)}
          onChange={(v) =>
            store.set('gameplay', 'gameSpeed', v === '70' ? 70 : v === '80' ? 80 : v === '90' ? 90 : 100)
          }
          options={choice([
            ['70', '70%'],
            ['80', '80%'],
            ['90', '90%'],
            ['100', '100%'],
          ])}
        />
      </Row>
      {toggle('autoFire', t('settings.gameplay.autoFire'))}
      {toggle('bossCheckpoints', t('settings.gameplay.bossCheckpoints'), t('settings.gameplay.bossHint'))}
      {toggle('hazardNoDamage', t('settings.gameplay.hazardNoDamage'), restart)}
      <h3 class="cd-setting-heading">{t('settings.gameplay.feedback')}</h3>
      <Row label={t('settings.gameplay.cameraShake')} wide>
        <Slider
          label={t('settings.gameplay.cameraShake')}
          value={g.cameraShake}
          min={0}
          max={100}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('gameplay', 'cameraShake', v)}
        />
      </Row>
      {toggle('hitStop', t('settings.gameplay.hitStop'))}
      <Row label={t('settings.gameplay.flashes')} hint={t('settings.gameplay.flashesHint')}>
        <Segmented
          label={t('settings.gameplay.flashes')}
          value={g.screenFlashes}
          onChange={(v) => store.set('gameplay', 'screenFlashes', v)}
          options={choice([
            ['full', t('settings.gameplay.full')],
            ['reduced', t('settings.gameplay.reduced')],
            ['off', t('common.off')],
          ])}
        />
      </Row>
      {toggle('damageNumbers', t('settings.gameplay.damageNumbers'))}
      {toggle('tutorialHints', t('settings.gameplay.tutorialHints'), t('settings.gameplay.tutorialHint'))}
    </>
  );
}

function AccessibilityTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const a = s.accessibility;
  return (
    <>
      <Row label={t('settings.access.textSize')} wide>
        <Slider
          label={t('settings.access.textSize')}
          value={a.textSize}
          min={90}
          max={150}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('accessibility', 'textSize', v)}
        />
      </Row>
      <Row label={t('settings.access.dialogueSpeed')} hint={t('settings.access.dialogueLater')}>
        <Segmented
          label={t('settings.access.dialogueSpeed')}
          value={a.dialogueSpeed}
          onChange={(v) => store.set('accessibility', 'dialogueSpeed', v)}
          options={choice([
            ['slow', t('settings.access.slow')],
            ['normal', t('settings.access.normal')],
            ['fast', t('settings.access.fast')],
            ['instant', t('settings.access.instant')],
          ])}
        />
      </Row>
      <Row label={t('settings.access.autoAdvance')} hint={t('settings.access.dialogueLater')}>
        <Toggle
          label={t('settings.access.autoAdvance')}
          checked={a.autoAdvance}
          onChange={(v) => store.set('accessibility', 'autoAdvance', v)}
        />
      </Row>
      <Row label={t('settings.access.captions')} hint={t('settings.access.captionsHint')}>
        <Toggle
          label={t('settings.access.captions')}
          checked={a.captions}
          onChange={(v) => store.set('accessibility', 'captions', v)}
        />
      </Row>
      <Row label={t('settings.access.highContrast')} hint={t('settings.access.highContrastHint')}>
        <Toggle
          label={t('settings.access.highContrast')}
          checked={a.highContrastHud}
          onChange={(v) => store.set('accessibility', 'highContrastHud', v)}
        />
      </Row>
      <Row label={t('settings.access.colorblind')} hint={t('settings.access.colorblindHint')}>
        <Segmented
          label={t('settings.access.colorblind')}
          value={a.colorblind}
          onChange={(v) => store.set('accessibility', 'colorblind', v)}
          options={choice([
            ['off', t('common.off')],
            ['protanopia', t('settings.access.protanopia')],
            ['deuteranopia', t('settings.access.deuteranopia')],
            ['tritanopia', t('settings.access.tritanopia')],
          ])}
        />
      </Row>
      <Row label={t('settings.access.reduceMotion')} hint={t('settings.access.reduceMotionHint')}>
        <Segmented
          label={t('settings.access.reduceMotion')}
          value={a.reduceMotion}
          onChange={(v) => store.set('accessibility', 'reduceMotion', v)}
          options={choice([
            ['system', t('settings.access.system')],
            ['on', t('common.on')],
            ['off', t('common.off')],
          ])}
        />
      </Row>
    </>
  );
}

function LanguageTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  return (
    <Row label={t('settings.language.language')} hint={t('settings.language.hint')}>
      <Segmented
        label={t('settings.language.language')}
        value={s.language.language ?? 'device'}
        onChange={(v) => store.set('language', 'language', v === 'device' ? null : v)}
        options={choice([
          ['device', t('settings.language.device')],
          ['en', t('settings.language.english')],
        ])}
      />
    </Row>
  );
}

function DataTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const t = useT();
  const { s, store } = props;
  const saves = t('settings.data.savesLater');
  return (
    <>
      <Row label={t('settings.data.saves')} hint={saves}>
        <div class="cd-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button disabled disabledReason={saves}>
            {t('settings.data.export')}
          </Button>
          <Button disabled disabledReason={saves}>
            {t('settings.data.import')}
          </Button>
          <Button variant="danger" disabled disabledReason={saves}>
            {t('settings.data.delete')}
          </Button>
        </div>
      </Row>
      <Row label={t('settings.data.privacy')} hint={t('settings.data.privacyHint')}>
        <Segmented
          label={t('settings.data.privacy')}
          value={s.data.networkPrivacy}
          onChange={(v) => store.set('data', 'networkPrivacy', v)}
          options={choice([
            ['direct', t('settings.data.direct')],
            ['relay', t('settings.data.relay')],
          ])}
        />
      </Row>
      <Row label={t('settings.data.diagnostics')} hint={t('settings.data.diagnosticsHint')}>
        <Toggle
          label={t('settings.data.diagnostics')}
          checked={s.data.diagnostics}
          onChange={(v) => store.set('data', 'diagnostics', v)}
        />
      </Row>
    </>
  );
}

function AboutTab(props: { readonly about: AboutInfo }): JSX.Element {
  const t = useT();
  return (
    <div class="cd-stack" data-role="about">
      <p class="cd-body">{t('settings.about.version', { version: props.about.version })}</p>
      <p class="cd-caption">{t('settings.about.build', { build: props.about.build })}</p>
      <p class="cd-body">{t('settings.about.credits')}</p>
      <p class="cd-body">{t('settings.about.privacy')}</p>
    </div>
  );
}

export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  const t = useT();
  const s = useStore(props.store.state);
  const { feedback } = useUi();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'audio');
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useNavScope(panel, { onBack: props.onClose, trap: true });
  useLayoutEffect(() => {
    const el = panel.current;
    play(backdrop.current, 'backdropIn', reduced);
    if (!el) return;
    // Rise from the gear icon (spec 8.4): transform origin at the icon, relative to the panel.
    const rect = el.getBoundingClientRect();
    const o = props.origin;
    const origin = o
      ? `${String(Math.round(o.x - rect.left))}px ${String(Math.round(o.y - rect.top))}px`
      : '50% 50%';
    play(el, 'settingsPopup', reduced, { origin });
    // Plays once on open.
  }, []);
  const body = (t: Tab): JSX.Element => {
    switch (t) {
      case 'audio':
        return <AudioTab s={s} store={props.store} />;
      case 'graphics':
        return <GraphicsTab s={s} store={props.store} />;
      case 'controls':
        return <ControlsTab s={s} store={props.store} />;
      case 'gameplay':
        return <GameplayTab s={s} store={props.store} />;
      case 'accessibility':
        return <AccessibilityTab s={s} store={props.store} />;
      case 'language':
        return <LanguageTab s={s} store={props.store} />;
      case 'data':
        return <DataTab s={s} store={props.store} />;
      case 'about':
        return <AboutTab about={props.about} />;
    }
  };
  // The footer scrolls with each tab's rows, so short (phone landscape) screens keep room for settings.
  const footer = (
    <div class="cd-row cd-settings-footer">
      <span class="cd-caption">{props.store.persistent ? t('settings.saved') : t('settings.notSaved')}</span>
      <Button
        variant="ghost"
        data-action="restore-defaults"
        onClick={() => {
          if (tab === 'about') return;
          props.store.resetTab(tab);
          feedback.sound('back');
        }}
      >
        {t('settings.restore')}
      </Button>
    </div>
  );
  const tabs = (Object.keys(TAB_KEYS) as Tab[]).map((id) => ({
    id,
    label: t(TAB_KEYS[id]),
    panel: (
      <div class="cd-settings-body" data-tab={id}>
        {body(id)}
        {id === 'about' ? null : footer}
      </div>
    ),
  }));
  return (
    <div class="cd-screen cd-settings-screen" style={{ zIndex: 25 }}>
      <div ref={backdrop} class="cd-backdrop" aria-hidden="true" onClick={props.onClose} />
      <div
        ref={panel}
        class="cd-panel cd-modal cd-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-role="modal"
        data-screen="settings"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <div class="cd-row">
          <h2 class="cd-title" id={titleId}>
            {t('settings.title')}
          </h2>
          <Button sound="back" data-action="close-settings" onClick={props.onClose}>
            {t('common.close')}
          </Button>
        </div>
        <Tabs
          label={t('settings.sections')}
          value={tab}
          onChange={setTab}
          tabs={tabs}
          panelClass="cd-settings-panel"
        />
      </div>
    </div>
  );
}
