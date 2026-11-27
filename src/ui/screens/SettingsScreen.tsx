import type { ComponentChildren, JSX } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Settings, SettingsTab } from '../../settings/SettingsSchema';
import type { SettingsStore } from '../../settings/SettingsStore';
import { Button, Segmented, Toggle } from '../components/Basics';
import { Slider, Tabs } from '../components/Inputs';
import { useReducedMotion, useUi } from '../context';
import { useNavScope } from '../hooks';
import { play } from '../motion';
import { useStore } from '../store';

/**
 * Settings (spec 8.6): every tab and row of the table. Changes apply live and persist at once. Rows for
 * systems that are not built yet still store the choice and say when it takes effect.
 */

type Tab = SettingsTab | 'about';

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  audio: 'Audio',
  graphics: 'Graphics',
  controls: 'Controls',
  gameplay: 'Gameplay',
  accessibility: 'Accessibility',
  language: 'Language',
  data: 'Data',
  about: 'About',
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
      {vol('master', 'Master volume')}
      {vol('music', 'Music', 'Music tracks arrive with the planets; the level is set now.')}
      {vol('sfx', 'Sound effects')}
      {vol('ui', 'Interface sounds')}
      {vol('voice', 'Voice blips', 'Voice blips arrive with dialogue (2E); the level is set now.')}
      <Row label="Mute when in background">
        <Toggle
          label="Mute when in background"
          checked={s.audio.muteInBackground}
          onChange={(v) => store.set('audio', 'muteInBackground', v)}
        />
      </Row>
      <Row label="Mono audio">
        <Toggle label="Mono audio" checked={s.audio.mono} onChange={(v) => store.set('audio', 'mono', v)} />
      </Row>
      <Row label="Dynamic range" hint="Night compresses loud and quiet sounds closer together.">
        <Segmented
          label="Dynamic range"
          value={s.audio.dynamicRange}
          onChange={(v) => store.set('audio', 'dynamicRange', v)}
          options={choice([
            ['full', 'Full'],
            ['night', 'Night'],
          ])}
        />
      </Row>
    </>
  );
}

function GraphicsTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  const g = s.graphics;
  return (
    <>
      <Row label="Quality preset" hint="Applies at the next level start or restart.">
        <Segmented
          label="Quality preset"
          value={g.preset}
          onChange={(v) => store.set('graphics', 'preset', v)}
          options={choice([
            ['auto', 'Auto'],
            ['battery', 'Battery'],
            ['balanced', 'Balanced'],
            ['high', 'High'],
          ])}
        />
      </Row>
      <Row label="Frame-rate cap">
        <Segmented
          label="Frame-rate cap"
          value={g.fpsCap}
          onChange={(v) => store.set('graphics', 'fpsCap', v)}
          options={choice([
            ['30', '30'],
            ['60', '60'],
            ['max', 'Display max'],
          ])}
        />
      </Row>
      <Row
        label="Render scale"
        hint={
          g.renderScale === null
            ? 'Follows the preset. Takes effect with the render-scale work (6A).'
            : 'Takes effect with the render-scale work (6A).'
        }
        wide
      >
        <div class="cd-row">
          <Toggle
            label="Render scale follows the preset"
            checked={g.renderScale === null}
            onChange={(follow) => store.set('graphics', 'renderScale', follow ? null : 100)}
          />
          {g.renderScale === null ? null : (
            <Slider
              label="Render scale"
              value={g.renderScale}
              min={70}
              max={100}
              format={(v) => `${String(v)}%`}
              onChange={(v) => store.set('graphics', 'renderScale', v)}
            />
          )}
        </div>
      </Row>
      <Row label="Particles" hint="Applies at the next level start or restart.">
        <Segmented<typeof PRESET | 'low' | 'medium' | 'high'>
          label="Particles"
          value={g.particles ?? PRESET}
          onChange={(v) => store.set('graphics', 'particles', v === PRESET ? null : v)}
          options={choice([
            [PRESET, 'Preset'],
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ])}
        />
      </Row>
      <Row label="Post effects" hint="Bloom, heat haze, and frost arrive with the planets that use them.">
        <Segmented
          label="Post effects"
          value={g.postEffects === null ? PRESET : g.postEffects ? 'on' : 'off'}
          onChange={(v) => store.set('graphics', 'postEffects', v === PRESET ? null : v === 'on')}
          options={choice([
            [PRESET, 'Preset'],
            ['on', 'On'],
            ['off', 'Off'],
          ])}
        />
      </Row>
      <Row label="Parallax layers" hint="Applies at the next level start or restart.">
        <Segmented
          label="Parallax layers"
          value={g.parallaxLayers === null ? PRESET : String(g.parallaxLayers)}
          onChange={(v) => store.set('graphics', 'parallaxLayers', v === PRESET ? null : v === '3' ? 3 : 5)}
          options={choice([
            [PRESET, 'Preset'],
            ['3', '3'],
            ['5', '5'],
          ])}
        />
      </Row>
      <Row
        label="Menu background"
        hint={
          g.menuBackground === 'planet'
            ? 'Current planet arrives with the hub (2D); until then it is animated.'
            : undefined
        }
      >
        <Segmented
          label="Menu background"
          value={g.menuBackground}
          onChange={(v) => store.set('graphics', 'menuBackground', v)}
          options={choice([
            ['animated', 'Animated'],
            ['static', 'Static'],
            ['planet', 'Current planet'],
          ])}
        />
      </Row>
      <Row label="Background effects intensity" wide>
        <Slider
          label="Background effects intensity"
          value={g.backgroundIntensity}
          min={0}
          max={100}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('graphics', 'backgroundIntensity', v)}
        />
      </Row>
      <Row label="Show FPS and frame time">
        <Toggle
          label="Show FPS and frame time"
          checked={g.showFps}
          onChange={(v) => store.set('graphics', 'showFps', v)}
        />
      </Row>
    </>
  );
}

function ControlsTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  const c = s.controls;
  return (
    <>
      <Row label="Layout preset" hint="Simple and Left-handed arrive with the layout editor (2B-4).">
        <Segmented
          label="Layout preset"
          value={c.layoutPreset}
          onChange={(v) => store.set('controls', 'layoutPreset', v)}
          options={choice([
            ['classic', 'Classic'],
            ['simple', 'Simple'],
            ['leftHanded', 'Left-handed'],
          ])}
        />
      </Row>
      <Row label="Edit layout">
        <Button disabled disabledReason="The layout editor arrives in step 2B-4.">
          Edit layout
        </Button>
      </Row>
      <Row label="Stick type">
        <Segmented
          label="Stick type"
          value={c.stickType}
          onChange={(v) => store.set('controls', 'stickType', v)}
          options={choice([
            ['floating', 'Floating'],
            ['fixed', 'Fixed'],
          ])}
        />
      </Row>
      <Row label="Button size" wide>
        <Slider
          label="Button size"
          value={c.buttonSize}
          min={75}
          max={150}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'buttonSize', v)}
        />
      </Row>
      <Row label="Button opacity" wide>
        <Slider
          label="Button opacity"
          value={c.buttonOpacity}
          min={30}
          max={100}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'buttonOpacity', v)}
        />
      </Row>
      <Row label="Stick deadzone" wide>
        <Slider
          label="Stick deadzone"
          value={c.deadzone}
          min={5}
          max={30}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'deadzone', v)}
        />
      </Row>
      <Row label="Outer saturation" wide>
        <Slider
          label="Outer saturation"
          value={c.saturation}
          min={70}
          max={98}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('controls', 'saturation', v)}
        />
      </Row>
      <Row
        label="Response curve"
        hint="1.0 is linear; higher values give finer control near the centre."
        wide
      >
        <Slider
          label="Response curve"
          value={c.curve}
          min={10}
          max={25}
          format={(v) => (v / 10).toFixed(1)}
          onChange={(v) => store.set('controls', 'curve', v)}
        />
      </Row>
      <Row
        label="Aim mode"
        hint={
          c.aimMode === 'assisted'
            ? 'Assisted aim arrives with the combat pass (3A); until then it aims like Manual.'
            : 'Default: Auto on touch, Manual with a mouse.'
        }
      >
        <Segmented
          label="Aim mode"
          value={c.aimMode ?? 'device'}
          onChange={(v) => store.set('controls', 'aimMode', v === 'device' ? null : v)}
          options={choice([
            ['device', 'Default'],
            ['auto', 'Auto'],
            ['assisted', 'Assisted'],
            ['manual', 'Manual'],
          ])}
        />
      </Row>
      <Row label="Shoot" hint="Toggle: press once to start firing, again to stop.">
        <Segmented
          label="Shoot"
          value={c.shoot}
          onChange={(v) => store.set('controls', 'shoot', v)}
          options={choice([
            ['hold', 'Hold'],
            ['toggle', 'Toggle'],
          ])}
        />
      </Row>
      <Row label="Haptics" hint="Vibration arrives with the Android app's haptics (7B).">
        <Segmented
          label="Haptics"
          value={c.haptics}
          onChange={(v) => store.set('controls', 'haptics', v)}
          options={choice([
            ['off', 'Off'],
            ['light', 'Light'],
            ['full', 'Full'],
          ])}
        />
      </Row>
      <Row label="Keyboard and gamepad bindings">
        <Button disabled disabledReason="Rebinding arrives in step 2B-5.">
          Rebind
        </Button>
      </Row>
    </>
  );
}

function GameplayTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  const g = s.gameplay;
  const restart = 'Takes effect when the level restarts.';
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
        label="Difficulty"
        hint={
          g.difficulty === 'drift_plus'
            ? 'Drift+ unlocks after the campaign; until then it plays as Hard.'
            : restart
        }
      >
        <Segmented
          label="Difficulty"
          value={g.difficulty}
          onChange={(v) => store.set('gameplay', 'difficulty', v)}
          options={choice([
            ['easy', 'Easy'],
            ['normal', 'Normal'],
            ['hard', 'Hard'],
            ['drift_plus', 'Drift+'],
          ])}
        />
      </Row>
      <h3 class="cd-setting-heading">Assist options</h3>
      {toggle('invulnerable', 'Invulnerability', restart)}
      {toggle('infiniteFuel', 'Infinite jetpack fuel', restart)}
      <Row label="Game speed">
        <Segmented
          label="Game speed"
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
      {toggle('autoFire', 'Auto-fire')}
      {toggle('bossCheckpoints', 'Boss phase checkpoints', 'Bosses arrive in Pass 3C.')}
      {toggle('hazardNoDamage', 'Hazard respawn without damage', restart)}
      <h3 class="cd-setting-heading">Feedback</h3>
      <Row label="Camera shake" wide>
        <Slider
          label="Camera shake"
          value={g.cameraShake}
          min={0}
          max={100}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('gameplay', 'cameraShake', v)}
        />
      </Row>
      {toggle('hitStop', 'Hit-stop')}
      <Row label="Screen flashes" hint="Nothing ever flashes more than three times per second.">
        <Segmented
          label="Screen flashes"
          value={g.screenFlashes}
          onChange={(v) => store.set('gameplay', 'screenFlashes', v)}
          options={choice([
            ['full', 'Full'],
            ['reduced', 'Reduced'],
            ['off', 'Off'],
          ])}
        />
      </Row>
      {toggle('damageNumbers', 'Damage numbers')}
      {toggle('tutorialHints', 'Tutorial hints', 'Hints arrive with the tutorial level (2F).')}
    </>
  );
}

function AccessibilityTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  const a = s.accessibility;
  return (
    <>
      <Row label="Text size" wide>
        <Slider
          label="Text size"
          value={a.textSize}
          min={90}
          max={150}
          step={5}
          format={(v) => `${String(v)}%`}
          onChange={(v) => store.set('accessibility', 'textSize', v)}
        />
      </Row>
      <Row label="Dialogue speed" hint="Dialogue arrives in Pass 2E.">
        <Segmented
          label="Dialogue speed"
          value={a.dialogueSpeed}
          onChange={(v) => store.set('accessibility', 'dialogueSpeed', v)}
          options={choice([
            ['slow', 'Slow'],
            ['normal', 'Normal'],
            ['fast', 'Fast'],
            ['instant', 'Instant'],
          ])}
        />
      </Row>
      <Row label="Auto-advance dialogue" hint="Dialogue arrives in Pass 2E.">
        <Toggle
          label="Auto-advance dialogue"
          checked={a.autoAdvance}
          onChange={(v) => store.set('accessibility', 'autoAdvance', v)}
        />
      </Row>
      <Row label="Sound captions" hint="Captions arrive in step 2B-3.">
        <Toggle
          label="Sound captions"
          checked={a.captions}
          onChange={(v) => store.set('accessibility', 'captions', v)}
        />
      </Row>
      <Row label="High-contrast HUD" hint="Arrives in step 2B-3.">
        <Toggle
          label="High-contrast HUD"
          checked={a.highContrastHud}
          onChange={(v) => store.set('accessibility', 'highContrastHud', v)}
        />
      </Row>
      <Row
        label="Colorblind palette"
        hint="Palettes arrive in step 2B-3. Hazards always carry stripe patterns."
      >
        <Segmented
          label="Colorblind palette"
          value={a.colorblind}
          onChange={(v) => store.set('accessibility', 'colorblind', v)}
          options={choice([
            ['off', 'Off'],
            ['protanopia', 'Protanopia'],
            ['deuteranopia', 'Deuteranopia'],
            ['tritanopia', 'Tritanopia'],
          ])}
        />
      </Row>
      <Row label="Reduce motion" hint="Menus change at once; the level follows at its next start.">
        <Segmented
          label="Reduce motion"
          value={a.reduceMotion}
          onChange={(v) => store.set('accessibility', 'reduceMotion', v)}
          options={choice([
            ['system', 'System'],
            ['on', 'On'],
            ['off', 'Off'],
          ])}
        />
      </Row>
    </>
  );
}

function LanguageTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  return (
    <Row label="Language" hint="More languages later. The device language is used when it is supported.">
      <Segmented
        label="Language"
        value={s.language.language ?? 'device'}
        onChange={(v) => store.set('language', 'language', v === 'device' ? null : v)}
        options={choice([
          ['device', 'Device'],
          ['en', 'English'],
        ])}
      />
    </Row>
  );
}

function DataTab(props: { readonly s: Settings; readonly store: SettingsStore }): JSX.Element {
  const { s, store } = props;
  const saves = 'Saves arrive in Pass 2C.';
  return (
    <>
      <Row label="Save slots" hint={saves}>
        <div class="cd-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button disabled disabledReason={saves}>
            Export backup
          </Button>
          <Button disabled disabledReason={saves}>
            Import backup
          </Button>
          <Button variant="danger" disabled disabledReason={saves}>
            Delete save
          </Button>
        </div>
      </Row>
      <Row
        label="Network privacy"
        hint="Relay only hides your IP address from other players and may add latency. Multiplayer arrives in Pass 4."
      >
        <Segmented
          label="Network privacy"
          value={s.data.networkPrivacy}
          onChange={(v) => store.set('data', 'networkPrivacy', v)}
          options={choice([
            ['direct', 'Direct'],
            ['relay', 'Relay only'],
          ])}
        />
      </Row>
      <Row
        label="Anonymous diagnostics"
        hint="Nothing is sent today; this choice is kept for when crash reports exist."
      >
        <Toggle
          label="Anonymous diagnostics"
          checked={s.data.diagnostics}
          onChange={(v) => store.set('data', 'diagnostics', v)}
        />
      </Row>
    </>
  );
}

function AboutTab(props: { readonly about: AboutInfo }): JSX.Element {
  return (
    <div class="cd-stack" data-role="about">
      <p class="cd-body">Cosmic Drift version {props.about.version}</p>
      <p class="cd-caption">Build {props.about.build}</p>
      <p class="cd-body">
        Made with Phaser, Preact, Vite, and Capacitor. Fonts: Exo 2 and Inter (SIL Open Font License). Sounds:
        Kenney (CC0). Full credits and licenses ship in docs/CREDITS.md.
      </p>
      <p class="cd-body">
        Privacy: the game stores its settings on this device only and sends nothing anywhere.
      </p>
    </div>
  );
}

export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
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
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).map((id) => ({
    id,
    label: TAB_LABELS[id],
    panel: (
      <div class="cd-settings-body" data-tab={id}>
        {body(id)}
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
            Settings
          </h2>
          <Button sound="back" data-action="close-settings" onClick={props.onClose}>
            Close
          </Button>
        </div>
        <Tabs
          label="Settings sections"
          value={tab}
          onChange={setTab}
          tabs={tabs}
          panelClass="cd-settings-panel"
        />
        {tab === 'about' ? null : (
          <div class="cd-row cd-settings-footer">
            <span class="cd-caption">
              {props.store.persistent
                ? 'Changes are saved on this device.'
                : 'This browser blocks storage: changes last until you close the game.'}
            </span>
            <Button
              variant="ghost"
              data-action="restore-defaults"
              onClick={() => {
                props.store.resetTab(tab);
                feedback.sound('back');
              }}
            >
              Restore defaults
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
