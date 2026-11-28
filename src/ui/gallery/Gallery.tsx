import type { JSX } from 'preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import {
  Badge,
  Button,
  ItemCard,
  NumberCounter,
  Panel,
  ProgressRing,
  Segmented,
  Stepper,
  Toggle,
} from '../components/Basics';
import { CodeInput, ScrollList, Slider, Tabs } from '../components/Inputs';
import { ConfirmDialog, Modal, SideSheet } from '../components/Overlays';
import { UiContext, useReducedMotion } from '../context';
import '../fonts';
import { PauseScreen, PhotosensitivityNotice, TitleScreen } from '../screens/Screens';
import { SettingsStore } from '../../settings/SettingsStore';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UiService } from '../UiService';

/** Dev-only component gallery (`?debug=1&gallery=1`): every component and screen, plus the transitions. */

function Section(props: {
  readonly title: string;
  readonly children?: preact.ComponentChildren;
}): JSX.Element {
  return (
    <section>
      <h2 class="cd-title">{props.title}</h2>
      {props.children}
    </section>
  );
}

function Gallery(props: { readonly service: UiService }): JSX.Element {
  const { service } = props;
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [step, setStep] = useState(3);
  const [volume, setVolume] = useState(70);
  const [tab, setTab] = useState<'one' | 'two'>('one');
  const [code, setCode] = useState('');
  const [card, setCard] = useState(false);
  const [counter, setCounter] = useState(120);
  const [modal, setModal] = useState<'none' | 'modal' | 'confirm' | 'sheet' | 'settings'>('none');
  const [motionOn, setMotionOn] = useState(false);
  const reduced = useReducedMotion();
  return (
    <div class="cd-gallery" data-role="gallery">
      <main>
        <h1 class="cd-display" style={{ fontSize: 'var(--size-display-small)' }}>
          Cosmic Drift UI gallery
        </h1>
        <p class="cd-caption">Reduced motion is {reduced ? 'on' : 'off'}.</p>
        <Section title="Buttons">
          <div class="cd-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="icon" label="Settings">
              ⚙
            </Button>
            <Button disabled disabledReason="Not enough shards">
              Disabled
            </Button>
            <Button selected>Selected</Button>
          </div>
        </Section>
        <Section title="Panel and chips">
          <Panel label="Example panel">
            <p class="cd-body">Glass panel with a 1 px stroke and a soft shadow.</p>
            <div class="cd-row" style={{ justifyContent: 'flex-start' }}>
              <Badge>Default</Badge>
              <Badge tone="shard">120 shards</Badge>
              <Badge tone="core">3 cores</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="success">Done</Badge>
            </div>
          </Panel>
        </Section>
        <Section title="Toggle, segmented, stepper">
          <div class="cd-row">
            <span>Screen shake</span>
            <Toggle label="Screen shake" checked={toggle} onChange={setToggle} />
          </div>
          <Segmented
            label="Difficulty"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'a', label: 'Easy' },
              { value: 'b', label: 'Normal' },
              { value: 'c', label: 'Hard' },
            ]}
          />
          <div class="cd-row">
            <span>Players</span>
            <Stepper label="Players" value={step} min={1} max={4} onChange={setStep} />
          </div>
        </Section>
        <Section title="Slider">
          <Slider
            label="Master volume"
            value={volume}
            min={0}
            max={100}
            onChange={setVolume}
            format={(v) => `${String(v)}%`}
          />
        </Section>
        <Section title="Tabs">
          <Tabs
            label="Example tabs"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'one', label: 'Weapons', panel: <p class="cd-body">First tab panel.</p> },
              { id: 'two', label: 'Gadgets', panel: <p class="cd-body">Second tab panel.</p> },
            ]}
          />
        </Section>
        <Section title="Code input">
          <CodeInput label="Room code" length={5} value={code} onChange={setCode} />
        </Section>
        <Section title="Item card, counter, progress ring">
          <ItemCard
            title="Shard Magnet"
            detail="Level 1 → 2 · 120 shards"
            selected={card}
            onSelect={() => {
              setCard(!card);
            }}
          />
          <div class="cd-row" style={{ justifyContent: 'flex-start' }}>
            <span class="cd-chip" data-tone="shard">
              <NumberCounter label="Shards" value={counter} />
            </span>
            <Button
              onClick={() => {
                setCounter(counter + 250);
              }}
            >
              Add 250
            </Button>
            <ProgressRing label="Loading" value={0.6} />
            <ProgressRing label="Waiting" value={null} />
          </div>
        </Section>
        <Section title="Scroll list">
          <ScrollList label="Example list" maxHeight="140px">
            {Array.from({ length: 12 }, (_, i) => (
              <div role="listitem" key={i} style={{ padding: '12px 0' }}>
                Row {i + 1}
              </div>
            ))}
          </ScrollList>
        </Section>
        <Section title="Overlays and toasts">
          <div class="cd-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <Button
              onClick={() => {
                setModal('modal');
              }}
            >
              Open modal
            </Button>
            <Button
              onClick={() => {
                setModal('confirm');
              }}
            >
              Open confirm
            </Button>
            <Button
              onClick={() => {
                setModal('sheet');
              }}
            >
              Open side sheet
            </Button>
            <Button
              onClick={() => {
                setModal('settings');
              }}
            >
              Open settings
            </Button>
            <Button
              onClick={() => {
                service.toast('Saved');
              }}
            >
              Toast
            </Button>
            <Button
              onClick={() => {
                service.toast('Something failed', 'danger');
              }}
            >
              Error toast
            </Button>
          </div>
        </Section>
        <Section title="Transitions">
          <div class="cd-row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            <Button
              data-action="demo-fade"
              onClick={() => {
                void service.transition('fade', () => {
                  setMotionOn(!motionOn);
                });
              }}
            >
              Fade through deep space
            </Button>
            <Button
              data-action="demo-iris"
              onClick={() => {
                void service.transition(
                  'iris',
                  () => {
                    setMotionOn(!motionOn);
                  },
                  { x: 160, y: 120 },
                );
              }}
            >
              Iris wipe
            </Button>
          </div>
        </Section>
        <Section title="Screens">
          <div class="cd-preview" data-preview="photosensitivity">
            <PhotosensitivityNotice preview onContinue={() => undefined} />
          </div>
          <div class="cd-preview" data-preview="title">
            <TitleScreen preview version="0.0.0" onStart={() => undefined} />
          </div>
          <div class="cd-preview" data-preview="pause">
            <PauseScreen preview perfShown={false} carriedShards={4} onAction={() => undefined} />
          </div>
        </Section>
      </main>
      {modal === 'modal' && (
        <Modal
          title="Example modal"
          onClose={() => {
            setModal('none');
          }}
        >
          <p class="cd-body">Escape or a backdrop tap closes this.</p>
          <Button
            variant="primary"
            onClick={() => {
              setModal('none');
            }}
          >
            Done
          </Button>
        </Modal>
      )}
      {modal === 'confirm' && (
        <ConfirmDialog
          title="Delete save?"
          message="This cannot be undone."
          confirmLabel="Delete"
          danger
          onCancel={() => {
            setModal('none');
          }}
          onConfirm={() => {
            setModal('none');
          }}
        />
      )}
      {modal === 'settings' && service.settings && (
        <SettingsScreen
          store={service.settings}
          about={service.about}
          onClose={() => {
            setModal('none');
          }}
        />
      )}
      {modal === 'sheet' && (
        <SideSheet
          title="Workshop"
          onClose={() => {
            setModal('none');
          }}
        >
          <p class="cd-body">Station panels slide in from the right.</p>
        </SideSheet>
      )}
    </div>
  );
}

/** Mounts the gallery as a standalone page (no game). */
export function mountGallery(host: HTMLElement): UiService {
  const service = new UiService({
    driven: false,
    settings: new SettingsStore(null),
    about: { version: '0.0.0', build: 'gallery' },
  });
  service.prefs.watchSystem(window);
  service.prefs.patch({ glass: true });
  service.mount(host);
  const page = document.createElement('div');
  service.root?.prepend(page);
  render(
    <UiContext.Provider value={service.context}>
      <Gallery service={service} />
    </UiContext.Provider>,
    page,
  );
  return service;
}
