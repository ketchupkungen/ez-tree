import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { zipSync } from 'three/addons/libs/fflate.module.js';
import { Billboard, TreePreset, Tree, TreeType } from '@dgreenheck/ez-tree';
import { BarkType, LeafType, applyTreeTextures, loadPresetWithTextures } from './textures';
import { Environment } from './environment';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { version } from '../../package.json';
import { fields, presets, newRecipe, validateRecipe } from './lab/recipes.js';
import { speciesFields } from './creature/creatures.js';

const exporter = new GLTFExporter();
// r167 writes `channel` here; glTF requires the texture-info field `texCoord`.
// Keep the installed exporter untouched and correct the material through its hook.
exporter.register(() => ({ name: 'EZTreeTextureCoordinateFix', writeMaterial(material, definition) {
  const texture = definition.pbrMetallicRoughness?.metallicRoughnessTexture;
  if (texture && texture.channel !== undefined) { texture.texCoord = texture.channel; delete texture.channel; }
} }));

// ============================================================================
// Heroicons (outline style)
// ============================================================================

const icons = {
  // Tab icons
  tree: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-6m0 0l-3-3m3 3l3-3m-3-3V3m0 9l-4-4m4 4l4-4" />
  </svg>`,

  archive: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>`,

  // Section icons
  swatch: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
  </svg>`,

  cube: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>`,

  share: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
  </svg>`,

  sparkles: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>`,

  videoCamera: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>`,

  sun: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>`,

  info: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>`,

  folder: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
  </svg>`,

  cubeTransparent: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3-2.25-1.313M12 12.75l2.25-1.313M12 12.75V15m0 6.75-2.25-1.313M12 21.75V19.5m0 2.25 2.25-1.313m0-16.875L12 2.25l-2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
  </svg>`,

  // Button icons
  dice: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
  </svg>`,

  document: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>`,

  folderOpen: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
  </svg>`,

  download: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>`,

  photo: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>`,

  spinner: `<svg class="icon icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path stroke-linecap="round" d="M21 12a9 9 0 0 0-9-9" />
  </svg>`,

  // Arrow icon for sections
  chevronRight: `<svg class="section-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>`,

  chevronRightSmall: `<svg class="subsection-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>`,

  chevronUp: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
  </svg>`,
};

// ============================================================================
// UI Component System
// ============================================================================

/**
 * Creates a slider control with label
 */
function createSlider(label, value, min, max, step, onChange) {
  const container = document.createElement('div');
  container.className = 'control-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;

  const sliderWrapper = document.createElement('div');
  sliderWrapper.className = 'slider-wrapper';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'slider';
  slider.setAttribute('aria-label', label);
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;

  const valueInput = document.createElement('input');
  valueInput.type = 'number';
  valueInput.className = 'slider-value';
  valueInput.value = formatValue(value, step);
  valueInput.step = step;
  valueInput.min = min; valueInput.max = max; valueInput.setAttribute('aria-label', `${label} value`);

  // Fill the track up to the current value so it reads at a glance
  const setFill = () => {
    const pct = ((parseFloat(slider.value) - min) / (max - min || 1)) * 100;
    slider.style.setProperty('--fill', `${pct}%`);
  };
  setFill();

  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valueInput.value = formatValue(val, step);
    setFill();
    onChange(val);
  });

  valueInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = min;
    val = Math.min(max, Math.max(min, val));
    val = Math.round((val - min) / step) * step + min;
    slider.value = val;
    valueInput.value = formatValue(val, step);
    setFill();
    onChange(val);
  });

  sliderWrapper.appendChild(slider);
  sliderWrapper.appendChild(valueInput);
  container.appendChild(labelEl);
  container.appendChild(sliderWrapper);

  return {
    element: container,
    setValue: (v) => {
      slider.value = v;
      valueInput.value = formatValue(v, step);
      setFill();
    }
  };
}

function formatValue(value, step) {
  if (step >= 1) return Math.round(value).toString();
  const decimals = step.toString().split('.')[1]?.length || 2;
  return value.toFixed(Math.min(decimals, 3));
}

/**
 * Creates a color picker control
 */
function createColorPicker(label, value, onChange) {
  const container = document.createElement('div');
  container.className = 'control-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;

  const pickerWrapper = document.createElement('div');
  pickerWrapper.className = 'color-picker-wrapper';

  const colorPreview = document.createElement('div');
  colorPreview.className = 'color-preview';
  colorPreview.style.backgroundColor = '#' + value.toString(16).padStart(6, '0');

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.className = 'color-picker';
  picker.value = '#' + value.toString(16).padStart(6, '0');

  picker.addEventListener('input', (e) => {
    const hex = parseInt(e.target.value.slice(1), 16);
    colorPreview.style.backgroundColor = e.target.value;
    onChange(hex);
  });

  pickerWrapper.appendChild(colorPreview);
  pickerWrapper.appendChild(picker);
  container.appendChild(labelEl);
  container.appendChild(pickerWrapper);

  return {
    element: container,
    setValue: (v) => {
      const hexStr = '#' + v.toString(16).padStart(6, '0');
      picker.value = hexStr;
      colorPreview.style.backgroundColor = hexStr;
    }
  };
}

/**
 * Creates a dropdown select control
 */
function createSelect(label, options, value, onChange) {
  const container = document.createElement('div');
  container.className = 'control-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;

  const selectWrapper = document.createElement('div');
  selectWrapper.className = 'select-wrapper';

  const select = document.createElement('select');
  select.className = 'select';
  select.setAttribute('aria-label', label);

  Object.entries(options).forEach(([key, val]) => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = key;
    if (val === value) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    onChange(e.target.value);
  });

  selectWrapper.appendChild(select);
  container.appendChild(labelEl);
  container.appendChild(selectWrapper);

  return {
    element: container,
    setValue: (v) => { select.value = v; }
  };
}

/**
 * Creates a checkbox/toggle control
 */
function createToggle(label, value, onChange) {
  const container = document.createElement('div');
  container.className = 'control-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;

  const toggleWrapper = document.createElement('div');
  toggleWrapper.className = 'toggle-wrapper';

  const toggle = document.createElement('button');
  toggle.className = 'toggle' + (value ? ' active' : '');
  toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-label', label); toggle.setAttribute('aria-checked', String(value));
  toggle.innerHTML = '<span class="toggle-knob"></span>';

  toggle.addEventListener('click', () => {
    const newValue = !toggle.classList.contains('active');
    toggle.classList.toggle('active', newValue);
    toggle.setAttribute('aria-checked', String(newValue));
    onChange(newValue);
  });

  toggleWrapper.appendChild(toggle);
  container.appendChild(labelEl);
  container.appendChild(toggleWrapper);

  return {
    element: container,
    setValue: (v) => {
      toggle.classList.toggle('active', v);
      toggle.setAttribute('aria-checked', String(v));
    }
  };
}

/**
 * Yields to the browser long enough for pending DOM updates to paint before
 * blocking work resumes on the main thread.
 */
function paint() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)),
  );
}

/**
 * Creates a button.
 *
 * `onClick` is called with a `setStatus(text)` callback. If it returns a
 * promise, the button shows a spinner and stays disabled until it settles.
 */
function createButton(label, iconKey, onClick) {
  const button = document.createElement('button');
  button.className = 'panel-button';
  const setContent = (text, key) => {
    button.innerHTML = `${icons[key] || ''}<span>${text}</span>`;
  };
  setContent(label, iconKey);

  let statusSet = false;
  const setStatus = (text) => {
    statusSet = true;
    setContent(text, 'spinner');
  };

  button.addEventListener('click', () => {
    if (button.disabled) return;
    statusSet = false;
    const result = onClick({ setStatus });
    if (!result?.then) return;

    button.disabled = true;
    if (!statusSet) setStatus('Working…');
    result.finally(() => {
      button.disabled = false;
      setContent(label, iconKey);
    });
  });
  return { element: button };
}

/**
 * Creates a read-only display
 */
function createDisplay(label, value, formatter = (v) => v) {
  const container = document.createElement('div');
  container.className = 'control-row display-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'display-value';
  valueEl.textContent = formatter(value);

  container.appendChild(labelEl);
  container.appendChild(valueEl);

  return {
    element: container,
    setValue: (v) => { valueEl.textContent = formatter(v); }
  };
}

/**
 * Creates a collapsible section
 */
function createSection(title, iconKey, expanded = false) {
  const section = document.createElement('div');
  section.className = 'panel-section' + (expanded ? ' expanded' : '');

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    ${icons[iconKey] || ''}
    <span class="section-title">${title}</span>
    ${icons.chevronRight}
  `;

  const contentWrap = document.createElement('div');
  contentWrap.className = 'section-content';

  const content = document.createElement('div');
  content.className = 'section-content-inner';
  contentWrap.appendChild(content);

  header.addEventListener('click', () => {
    section.classList.toggle('expanded');
  });

  section.appendChild(header);
  section.appendChild(contentWrap);

  return {
    element: section,
    content: content,
    add: (control) => content.appendChild(control.element || control),
    setExpanded: (exp) => section.classList.toggle('expanded', exp)
  };
}

/**
 * Creates a sub-section (nested within a section)
 */
function createSubSection(title, expanded = false) {
  const section = document.createElement('div');
  section.className = 'panel-subsection' + (expanded ? ' expanded' : '');

  const header = document.createElement('div');
  header.className = 'subsection-header';
  header.innerHTML = `
    <span class="subsection-title">${title}</span>
    ${icons.chevronRightSmall}
  `;

  const contentWrap = document.createElement('div');
  contentWrap.className = 'subsection-content';

  const content = document.createElement('div');
  content.className = 'subsection-content-inner';
  contentWrap.appendChild(content);

  header.addEventListener('click', (e) => {
    e.stopPropagation();
    section.classList.toggle('expanded');
  });

  section.appendChild(header);
  section.appendChild(contentWrap);

  return {
    element: section,
    content: content,
    add: (control) => content.appendChild(control.element || control)
  };
}

// ============================================================================
// Main UI Setup
// ============================================================================

let controls = [];

/**
 * Setups the UI
 * @param {Tree} tree
 * @param {Environment} environment
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {OrbitControls} orbitControls
 * @param {String} initialPreset
 */
export function setupUI(tree, environment, renderer, scene, camera, orbitControls, initialPreset, modes, forestPreview, treeTraits) {
  const container = document.getElementById('ui-container');
  container.innerHTML = '';
  controls = [];

  // Create main panel
  const panel = document.createElement('div');
  panel.className = 'custom-panel';
  panel.id = 'custom-panel';

  // Panel header with mobile toggle
  const header = document.createElement('div');
  header.className = 'panel-header';
  header.innerHTML = `
    <div class="panel-grabber" aria-hidden="true"></div>
    <button class="panel-mobile-toggle" aria-label="Toggle panel">
      ${icons.chevronUp}
    </button>
    <h1 class="panel-title">EZ Tree</h1>
    <p class="panel-subtitle">Procedural Tree Generator</p>
  `;
  panel.appendChild(header);

  // Scrollable content area
  const scrollArea = document.createElement('div');
  scrollArea.className = 'panel-scroll-area';
  panel.appendChild(scrollArea);

  // A single mode slider extends the source panel without changing its layout.
  const modeNames = ['tree', 'plant', 'creature'];
  const modeControl = document.createElement('div');
  modeControl.className = 'mode-control';
  modeControl.innerHTML = `<label for="generator-mode">Generator mode</label>
    <input id="generator-mode" type="range" min="0" max="2" step="1" value="0" aria-label="Generator mode" aria-valuetext="Tree">
    <div class="mode-labels"><button type="button" data-mode="tree" aria-pressed="true">Tree</button><button type="button" data-mode="plant" aria-pressed="false">Plant</button><button type="button" data-mode="creature" aria-pressed="false">Creature</button></div>`;
  scrollArea.appendChild(modeControl);
  const getModel = () => modes?.model ?? tree;

  // Tab navigation
  const tabNav = document.createElement('div');
  tabNav.className = 'tab-nav';
  tabNav.innerHTML = `
    <button class="tab-button active" data-tab="parameters">
      ${icons.tree}
      <span class="tab-label">Tree</span>
    </button>
    <button class="tab-button" data-tab="export">
      ${icons.archive}
      <span class="tab-label">Export</span>
    </button>
  `;
  scrollArea.appendChild(tabNav);

  const tabButtons = tabNav.querySelectorAll('.tab-button');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Parameters tab
  const parametersTab = document.createElement('div');
  parametersTab.className = 'tab-content active';
  parametersTab.id = 'tab-parameters';
  scrollArea.appendChild(parametersTab);

  // Export tab
  const exportTab = document.createElement('div');
  exportTab.className = 'tab-content';
  exportTab.id = 'tab-export';
  scrollArea.appendChild(exportTab);

  // ============================================================================
  // Stats Overlay (viewport HUD) with LOD preview switching
  // ============================================================================

  // The hero tree always generates at full detail; the LOD buttons re-mesh
  // its geometry at a chosen level via createGeometry() so it can be
  // inspected at any camera distance without THREE.LOD auto-switching.
  let previewLevel = 0;
  let lastBuildMs = null;

  const statsOverlay = document.createElement('div');
  statsOverlay.id = 'stats-overlay';
  statsOverlay.innerHTML = `
    <div class="stats-counts">
      <div class="stats-stat">
        <span class="stats-value" data-stat="triangles">0</span>
        <span class="stats-label">triangles</span>
      </div>
      <div class="stats-stat">
        <span class="stats-value" data-stat="vertices">0</span>
        <span class="stats-label">vertices</span>
      </div>
      <div class="stats-stat">
        <span class="stats-value" data-stat="buildtime">–</span>
        <span class="stats-label">build ms</span>
      </div>
    </div>
    <div class="lod-switcher"></div>
  `;
  container.appendChild(statsOverlay);

  const statsTriangles = statsOverlay.querySelector('[data-stat="triangles"]');
  const statsVertices = statsOverlay.querySelector('[data-stat="vertices"]');
  const statsBuildTime = statsOverlay.querySelector('[data-stat="buildtime"]');

  /** Briefly highlights a stat value so live changes are visible */
  function pulseStat(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  const lodSwitcher = statsOverlay.querySelector('.lod-switcher');
  const lodButtons = Tree.defaultLODLevels.map((level, i) => {
    const btn = document.createElement('button');
    btn.className = 'lod-button' + (i === 0 ? ' active' : '');
    btn.textContent = i === 0 ? 'Full' : `LOD${i}`;
    btn.title = i === 0
      ? 'Full detail'
      : `Preview detail level ${i} (switches at ${level.distance} units)`;
    btn.addEventListener('click', () => setPreviewLevel(i));
    lodSwitcher.appendChild(btn);
    return btn;
  });

  function applyLODPreview() {
    const detail = Tree.defaultLODLevels[previewLevel]?.detail ?? {};
    const t0 = performance.now();
    const { branches, leaves } = tree.createGeometry(detail);
    lastBuildMs = performance.now() - t0;
    tree.branchesMesh.geometry.dispose();
    tree.branchesMesh.geometry = branches;
    tree.leavesMesh.geometry.dispose();
    tree.leavesMesh.geometry = leaves;
  }

  function setPreviewLevel(level) {
    if (modes && modes.mode !== 'tree') return;
    previewLevel = level;
    lodButtons.forEach((b, i) => b.classList.toggle('active', i === level));
    applyLODPreview();
    treeTraits.setLOD(level);
    updateInfoDisplays();
  }

  /** Vertex/triangle counts of the geometry currently on screen */
  function displayedCounts() {
    let vertices = 0, triangles = 0;
    getModel().traverse(o => {
      if (!o.isMesh) return;
      const geometry = o.geometry;
      vertices += geometry.attributes.position?.count ?? 0;
      triangles += (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3;
    });
    return { vertices, triangles };
  }

  // ============================================================================
  // Parameters Tab Content
  // ============================================================================

  const onChange = () => {
    applyTreeTextures(tree);
    const t0 = performance.now();
    tree.generate();
    treeTraits.sourceChanged();
    forestPreview.requestRefresh();
    lastBuildMs = performance.now() - t0;
    if (previewLevel > 0) {
      applyLODPreview();
    }
    tree.traverse((o) => {
      if (o.material) {
        o.material.needsUpdate = true;
      }
    });
    // Update info displays
    updateInfoDisplays();
  };

  // ----- Presets Section -----
  const presetsSection = createSection('Presets', 'swatch', true);

  const presetSelect = createSelect('Preset',
    Object.fromEntries(Object.keys(TreePreset).map(p => [p, p])),
    initialPreset,
    (val) => {
      loadPresetWithTextures(tree, val);
      treeTraits.sourceChanged();
      forestPreview.requestRefresh();
      if (previewLevel > 0) {
        applyLODPreview();
      }
      refreshAllControls();
    }
  );
  presetsSection.add(presetSelect);
  controls.push({ control: presetSelect, update: () => {} });

  const seedSlider = createSlider('Seed', tree.options.seed, 0, 65536, 1, (val) => {
    tree.options.seed = val;
    onChange();
  });
  presetsSection.add(seedSlider);
  controls.push({ control: seedSlider, update: () => seedSlider.setValue(tree.options.seed) });

  const randomSeedBtn = createButton('Random Seed', 'dice', () => {
    tree.options.seed = Math.floor(Math.random() * 65536);
    seedSlider.setValue(tree.options.seed);
    onChange();
  });
  presetsSection.add(randomSeedBtn);

  parametersTab.appendChild(presetsSection.element);

  // ----- Bark Section -----
  const barkSection = createSection('Bark', 'cube', false);

  const barkTypeSelect = createSelect('Type', BarkType, tree.options.bark.type, (val) => {
    tree.options.bark.type = val;
    onChange();
  });
  barkSection.add(barkTypeSelect);
  controls.push({ control: barkTypeSelect, update: () => barkTypeSelect.setValue(tree.options.bark.type) });

  const barkTintPicker = createColorPicker('Tint', tree.options.bark.tint, (val) => {
    tree.options.bark.tint = val;
    onChange();
  });
  barkSection.add(barkTintPicker);
  controls.push({ control: barkTintPicker, update: () => barkTintPicker.setValue(tree.options.bark.tint) });

  const flatShadingToggle = createToggle('Flat Shading', tree.options.bark.flatShading, (val) => {
    tree.options.bark.flatShading = val;
    onChange();
  });
  barkSection.add(flatShadingToggle);
  controls.push({ control: flatShadingToggle, update: () => flatShadingToggle.setValue(tree.options.bark.flatShading) });

  const texturedToggle = createToggle('Textured', tree.options.bark.textured, (val) => {
    tree.options.bark.textured = val;
    onChange();
  });
  barkSection.add(texturedToggle);
  controls.push({ control: texturedToggle, update: () => texturedToggle.setValue(tree.options.bark.textured) });

  const texScaleXSlider = createSlider('Texture Scale X', tree.options.bark.textureScale.x, 0.5, 5, 0.1, (val) => {
    tree.options.bark.textureScale.x = val;
    onChange();
  });
  barkSection.add(texScaleXSlider);
  controls.push({ control: texScaleXSlider, update: () => texScaleXSlider.setValue(tree.options.bark.textureScale.x) });

  const texScaleYSlider = createSlider('Texture Scale Y', tree.options.bark.textureScale.y, 0.5, 5, 0.1, (val) => {
    tree.options.bark.textureScale.y = val;
    onChange();
  });
  barkSection.add(texScaleYSlider);
  controls.push({ control: texScaleYSlider, update: () => texScaleYSlider.setValue(tree.options.bark.textureScale.y) });

  parametersTab.appendChild(barkSection.element);

  // ----- Branches Section -----
  const branchSection = createSection('Branches', 'share', false);

  const treeTypeSelect = createSelect('Tree Type', TreeType, tree.options.type, (val) => {
    tree.options.type = val;
    onChange();
  });
  branchSection.add(treeTypeSelect);
  controls.push({ control: treeTypeSelect, update: () => treeTypeSelect.setValue(tree.options.type) });

  const levelsSlider = createSlider('Levels', tree.options.branch.levels, 0, 3, 1, (val) => {
    tree.options.branch.levels = val;
    onChange();
  });
  branchSection.add(levelsSlider);
  controls.push({ control: levelsSlider, update: () => levelsSlider.setValue(tree.options.branch.levels) });

  // Angle subsection
  const angleSubsection = createSubSection('Angle');
  for (let i = 1; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.angle[i], 0, 180, 1, (val) => {
      tree.options.branch.angle[i] = val;
      onChange();
    });
    angleSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.angle[i]) });
  }
  branchSection.add(angleSubsection);

  // Children subsection
  const childrenSubsection = createSubSection('Children');
  const childrenRanges = [[0, 100], [1, 10], [2, 5]];
  childrenRanges.forEach(([level, max]) => {
    const slider = createSlider(`Level ${level}`, tree.options.branch.children[level], 0, max, 1, (val) => {
      tree.options.branch.children[level] = val;
      onChange();
    });
    childrenSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.children[level]) });
  });
  branchSection.add(childrenSubsection);

  // Gnarliness subsection
  const gnarlinessSubsection = createSubSection('Gnarliness');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.gnarliness[i], -0.5, 0.5, 0.01, (val) => {
      tree.options.branch.gnarliness[i] = val;
      onChange();
    });
    gnarlinessSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.gnarliness[i]) });
  }
  branchSection.add(gnarlinessSubsection);

  // Growth Direction subsection
  const forceSubsection = createSubSection('Growth Direction');
  ['x', 'y', 'z'].forEach(axis => {
    const slider = createSlider(`Direction ${axis.toUpperCase()}`, tree.options.branch.force.direction[axis], -1, 1, 0.01, (val) => {
      tree.options.branch.force.direction[axis] = val;
      onChange();
    });
    forceSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.force.direction[axis]) });
  });
  const strengthSlider = createSlider('Strength', tree.options.branch.force.strength, -0.1, 0.1, 0.001, (val) => {
    tree.options.branch.force.strength = val;
    onChange();
  });
  forceSubsection.add(strengthSlider);
  controls.push({ control: strengthSlider, update: () => strengthSlider.setValue(tree.options.branch.force.strength) });
  branchSection.add(forceSubsection);

  // Length subsection
  const lengthSubsection = createSubSection('Length');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.length[i], 0.1, 100, 0.1, (val) => {
      tree.options.branch.length[i] = val;
      onChange();
    });
    lengthSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.length[i]) });
  }
  branchSection.add(lengthSubsection);

  // Radius subsection
  const radiusSubsection = createSubSection('Radius');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.radius[i], 0.1, 5, 0.01, (val) => {
      tree.options.branch.radius[i] = val;
      onChange();
    });
    radiusSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.radius[i]) });
  }
  branchSection.add(radiusSubsection);

  // Sections subsection
  const sectionsSubsection = createSubSection('Sections');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.sections[i], 1, 20, 1, (val) => {
      tree.options.branch.sections[i] = val;
      onChange();
    });
    sectionsSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.sections[i]) });
  }
  branchSection.add(sectionsSubsection);

  // Segments subsection
  const segmentsSubsection = createSubSection('Segments');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.segments[i], 3, 16, 1, (val) => {
      tree.options.branch.segments[i] = val;
      onChange();
    });
    segmentsSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.segments[i]) });
  }
  branchSection.add(segmentsSubsection);

  // Start subsection
  const startSubsection = createSubSection('Start Position');
  for (let i = 1; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.start[i], 0, 1, 0.01, (val) => {
      tree.options.branch.start[i] = val;
      onChange();
    });
    startSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.start[i]) });
  }
  branchSection.add(startSubsection);

  // Taper subsection
  const taperSubsection = createSubSection('Taper');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.taper[i], 0, 1, 0.01, (val) => {
      tree.options.branch.taper[i] = val;
      onChange();
    });
    taperSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.taper[i]) });
  }
  branchSection.add(taperSubsection);

  // Twist subsection
  const twistSubsection = createSubSection('Twist');
  for (let i = 0; i <= 3; i++) {
    const slider = createSlider(`Level ${i}`, tree.options.branch.twist[i], -0.5, 0.5, 0.01, (val) => {
      tree.options.branch.twist[i] = val;
      onChange();
    });
    twistSubsection.add(slider);
    controls.push({ control: slider, update: () => slider.setValue(tree.options.branch.twist[i]) });
  }
  branchSection.add(twistSubsection);

  parametersTab.appendChild(branchSection.element);

  // ----- Leaves Section -----
  const leavesSection = createSection('Leaves', 'sparkles', false);

  const leafTypeSelect = createSelect('Type', LeafType, tree.options.leaves.type, (val) => {
    tree.options.leaves.type = val;
    onChange();
  });
  leavesSection.add(leafTypeSelect);
  controls.push({ control: leafTypeSelect, update: () => leafTypeSelect.setValue(tree.options.leaves.type) });

  const leafTintPicker = createColorPicker('Tint', tree.options.leaves.tint, (val) => {
    tree.options.leaves.tint = val;
    onChange();
  });
  leavesSection.add(leafTintPicker);
  controls.push({ control: leafTintPicker, update: () => leafTintPicker.setValue(tree.options.leaves.tint) });

  const billboardSelect = createSelect('Billboard', Billboard, tree.options.leaves.billboard, (val) => {
    tree.options.leaves.billboard = val;
    onChange();
  });
  leavesSection.add(billboardSelect);
  controls.push({ control: billboardSelect, update: () => billboardSelect.setValue(tree.options.leaves.billboard) });

  const leafAngleSlider = createSlider('Angle', tree.options.leaves.angle, 0, 100, 1, (val) => {
    tree.options.leaves.angle = val;
    onChange();
  });
  leavesSection.add(leafAngleSlider);
  controls.push({ control: leafAngleSlider, update: () => leafAngleSlider.setValue(tree.options.leaves.angle) });

  const leafCountSlider = createSlider('Count', tree.options.leaves.count, 0, 100, 1, (val) => {
    tree.options.leaves.count = val;
    onChange();
  });
  leavesSection.add(leafCountSlider);
  controls.push({ control: leafCountSlider, update: () => leafCountSlider.setValue(tree.options.leaves.count) });

  const leafStartSlider = createSlider('Start', tree.options.leaves.start, 0, 1, 0.01, (val) => {
    tree.options.leaves.start = val;
    onChange();
  });
  leavesSection.add(leafStartSlider);
  controls.push({ control: leafStartSlider, update: () => leafStartSlider.setValue(tree.options.leaves.start) });

  const leafSizeSlider = createSlider('Size', tree.options.leaves.size, 0, 10, 0.1, (val) => {
    tree.options.leaves.size = val;
    onChange();
  });
  leavesSection.add(leafSizeSlider);
  controls.push({ control: leafSizeSlider, update: () => leafSizeSlider.setValue(tree.options.leaves.size) });

  const leafVarianceSlider = createSlider('Size Variance', tree.options.leaves.sizeVariance, 0, 1, 0.01, (val) => {
    tree.options.leaves.sizeVariance = val;
    onChange();
  });
  leavesSection.add(leafVarianceSlider);
  controls.push({ control: leafVarianceSlider, update: () => leafVarianceSlider.setValue(tree.options.leaves.sizeVariance) });

  const alphaTestSlider = createSlider('Alpha Test', tree.options.leaves.alphaTest, 0, 1, 0.01, (val) => {
    tree.options.leaves.alphaTest = val;
    onChange();
  });
  leavesSection.add(alphaTestSlider);
  controls.push({ control: alphaTestSlider, update: () => alphaTestSlider.setValue(tree.options.leaves.alphaTest) });

  const roundedNormalsToggle = createToggle('Rounded Normals', tree.options.leaves.roundedNormals, (val) => {
    tree.options.leaves.roundedNormals = val;
    onChange();
  });
  leavesSection.add(roundedNormalsToggle);
  controls.push({ control: roundedNormalsToggle, update: () => roundedNormalsToggle.setValue(tree.options.leaves.roundedNormals) });

  parametersTab.appendChild(leavesSection.element);

  // ----- Trellis Section -----
  const trellisSection = createSection('Trellis', 'share', false);

  const trellisEnabledToggle = createToggle('Enabled', tree.options.trellis.enabled, (val) => {
    tree.options.trellis.enabled = val;
    onChange();
  });
  trellisSection.add(trellisEnabledToggle);
  controls.push({ control: trellisEnabledToggle, update: () => trellisEnabledToggle.setValue(tree.options.trellis.enabled) });

  const trellisVisibleToggle = createToggle('Visible', tree.options.trellis.visible, (val) => {
    tree.options.trellis.visible = val;
    onChange();
  });
  trellisSection.add(trellisVisibleToggle);
  controls.push({ control: trellisVisibleToggle, update: () => trellisVisibleToggle.setValue(tree.options.trellis.visible) });

  // Position subsection
  const trellisPositionSubsection = createSubSection('Position');
  const trellisPosXSlider = createSlider('X', tree.options.trellis.position.x, -20, 20, 0.1, (val) => {
    tree.options.trellis.position.x = val;
    onChange();
  });
  trellisPositionSubsection.add(trellisPosXSlider);
  controls.push({ control: trellisPosXSlider, update: () => trellisPosXSlider.setValue(tree.options.trellis.position.x) });

  const trellisPosYSlider = createSlider('Y', tree.options.trellis.position.y, -10, 10, 0.1, (val) => {
    tree.options.trellis.position.y = val;
    onChange();
  });
  trellisPositionSubsection.add(trellisPosYSlider);
  controls.push({ control: trellisPosYSlider, update: () => trellisPosYSlider.setValue(tree.options.trellis.position.y) });

  const trellisPosZSlider = createSlider('Z', tree.options.trellis.position.z, -20, 20, 0.1, (val) => {
    tree.options.trellis.position.z = val;
    onChange();
  });
  trellisPositionSubsection.add(trellisPosZSlider);
  controls.push({ control: trellisPosZSlider, update: () => trellisPosZSlider.setValue(tree.options.trellis.position.z) });
  trellisSection.add(trellisPositionSubsection);

  // Dimensions subsection
  const trellisDimensionsSubsection = createSubSection('Dimensions');
  const trellisWidthSlider = createSlider('Width', tree.options.trellis.width, 1, 50, 0.5, (val) => {
    tree.options.trellis.width = val;
    onChange();
  });
  trellisDimensionsSubsection.add(trellisWidthSlider);
  controls.push({ control: trellisWidthSlider, update: () => trellisWidthSlider.setValue(tree.options.trellis.width) });

  const trellisHeightSlider = createSlider('Height', tree.options.trellis.height, 1, 50, 0.5, (val) => {
    tree.options.trellis.height = val;
    onChange();
  });
  trellisDimensionsSubsection.add(trellisHeightSlider);
  controls.push({ control: trellisHeightSlider, update: () => trellisHeightSlider.setValue(tree.options.trellis.height) });

  const trellisSpacingSlider = createSlider('Spacing', tree.options.trellis.spacing, 0.5, 10, 0.1, (val) => {
    tree.options.trellis.spacing = val;
    onChange();
  });
  trellisDimensionsSubsection.add(trellisSpacingSlider);
  controls.push({ control: trellisSpacingSlider, update: () => trellisSpacingSlider.setValue(tree.options.trellis.spacing) });
  trellisSection.add(trellisDimensionsSubsection);

  // Force subsection
  const trellisForceSubsection = createSubSection('Force');
  const trellisStrengthSlider = createSlider('Strength', tree.options.trellis.force.strength, 0, 0.2, 0.001, (val) => {
    tree.options.trellis.force.strength = val;
    onChange();
  });
  trellisForceSubsection.add(trellisStrengthSlider);
  controls.push({ control: trellisStrengthSlider, update: () => trellisStrengthSlider.setValue(tree.options.trellis.force.strength) });

  const trellisMaxDistSlider = createSlider('Max Distance', tree.options.trellis.force.maxDistance, 0.5, 20, 0.1, (val) => {
    tree.options.trellis.force.maxDistance = val;
    onChange();
  });
  trellisForceSubsection.add(trellisMaxDistSlider);
  controls.push({ control: trellisMaxDistSlider, update: () => trellisMaxDistSlider.setValue(tree.options.trellis.force.maxDistance) });

  const trellisFalloffSlider = createSlider('Falloff', tree.options.trellis.force.falloff, 0.1, 3, 0.1, (val) => {
    tree.options.trellis.force.falloff = val;
    onChange();
  });
  trellisForceSubsection.add(trellisFalloffSlider);
  controls.push({ control: trellisFalloffSlider, update: () => trellisFalloffSlider.setValue(tree.options.trellis.force.falloff) });
  trellisSection.add(trellisForceSubsection);

  // Appearance subsection
  const trellisAppearanceSubsection = createSubSection('Appearance');
  const trellisCylinderRadiusSlider = createSlider('Cylinder Radius', tree.options.trellis.cylinderRadius, 0.01, 0.5, 0.01, (val) => {
    tree.options.trellis.cylinderRadius = val;
    onChange();
  });
  trellisAppearanceSubsection.add(trellisCylinderRadiusSlider);
  controls.push({ control: trellisCylinderRadiusSlider, update: () => trellisCylinderRadiusSlider.setValue(tree.options.trellis.cylinderRadius) });

  const trellisColorPicker = createColorPicker('Color', tree.options.trellis.color, (val) => {
    tree.options.trellis.color = val;
    onChange();
  });
  trellisAppearanceSubsection.add(trellisColorPicker);
  controls.push({ control: trellisColorPicker, update: () => trellisColorPicker.setValue(tree.options.trellis.color) });
  trellisSection.add(trellisAppearanceSubsection);

  parametersTab.appendChild(trellisSection.element);

  const rootsSection = createSection('Roots', 'tree', false);
  rootsSection.element.id = 'tree-root-controls';
  const rootEnable = createToggle('Root System', tree.options.roots.enabled, value => treeTraits.configureRoots({ enabled: value }));
  rootsSection.add(rootEnable); controls.push({ update: () => rootEnable.setValue(tree.options.roots.enabled) });
  for (const [key, label, min, max, step] of [['count','Main Roots',3,16,1],['spread','Root Reach',2,14,0.5],['thickness','Root Width',0.2,1.2,0.05],['forks','Root Forks',0,3,1],['relief','Ground Relief',0,6,0.25]]) {
    const slider = createSlider(label, tree.options.roots[key], min, max, step, value => treeTraits.configureRoots({ [key]: value }));
    rootsSection.add(slider); controls.push({ update: () => slider.setValue(tree.options.roots[key]) });
  }
  const groundSelect = createSelect('Root Ground', { Flat:'Flat', Slope:'Slope', Rocky:'Rocky' }, tree.options.roots.ground, value => treeTraits.configureRoots({ ground: value }));
  rootsSection.add(createButton('Inspect Roots', 'videoCamera', () => treeTraits.inspectRoots()));
  rootsSection.add(groundSelect); controls.push({ update: () => groundSelect.setValue(tree.options.roots.ground) });
  const bakeRoots = createToggle('Bake Ground', tree.options.roots.bakeTerrain, value => treeTraits.configureRoots({ bakeTerrain: value }));
  rootsSection.add(bakeRoots); controls.push({ update: () => bakeRoots.setValue(tree.options.roots.bakeTerrain) });
  const rootNote = document.createElement('p'); rootNote.className = 'mode-status'; rootNote.textContent = 'Wrap roots over the preview terrain. Keep Bake Ground off to export neutral roots and contact weights for your game.'; rootsSection.add(rootNote);
  parametersTab.appendChild(rootsSection.element);

  const chopSection = createSection('Chop & Breakage', 'cube', false);
  chopSection.element.id = 'tree-chop-controls';
  const breakEnable = createToggle('Breakable', tree.options.destruction.enabled, value => treeTraits.configureDestruction({ enabled: value }));
  chopSection.add(breakEnable); controls.push({ update: () => breakEnable.setValue(tree.options.destruction.enabled) });
  for (const [key,label,min,max,step] of [['cut','Cut Position',0.02,0.75,0.01],['direction','Fall Direction',0,360,5],['gravity','Gravity',1,30,0.5]]) {
    const slider = createSlider(label, tree.options.destruction[key], min, max, step, value => treeTraits.configureDestruction({ [key]: value }));
    chopSection.add(slider); controls.push({ update: () => slider.setValue(tree.options.destruction[key]) });
  }
  const branchBreak = createToggle('Snap Branches', tree.options.destruction.breakBranches, value => treeTraits.configureDestruction({ breakBranches: value }));
  chopSection.add(branchBreak); controls.push({ update: () => branchBreak.setValue(tree.options.destruction.breakBranches) });
  const chopStatus = document.createElement('p'); chopStatus.className = 'mode-status'; chopStatus.id = 'tree-chop-status'; chopStatus.setAttribute('role','status');
  chopSection.add(createButton('Try Chopping', 'tree', async () => { await paint(); try { treeTraits.tryChop(); breakEnable.setValue(true); } catch (error) { chopStatus.textContent = error.message; } }));
  chopSection.add(createButton('Reset Tree', 'tree', () => treeTraits.reset()));
  chopSection.add(chopStatus);
  treeTraits.onChange = () => {
    if (!treeTraits.asset) chopStatus.textContent = 'Choose a cut, then try chopping. Breakable Tree enables capped parts, trunk snap joints and a TryChop clip in GLB exports.';
    else { const t = treeTraits.elapsed, events = treeTraits.demo.events.filter(e => e.type === 'branchImpact' && e.time <= t).length, settled = treeTraits.demo.events.some(e => e.type === 'settled' && e.time <= t); chopStatus.textContent = `${t < 0.65 ? 'Chopping' : settled ? 'Landed' : 'Falling'} · ${events} branch impacts · ${t.toFixed(1)} / ${treeTraits.demo.duration.toFixed(1)} s`; }
  };
  treeTraits.onChange(); parametersTab.appendChild(chopSection.element);

  // Keep every upstream tree control together; common scene controls stay below.
  const treeParameters = document.createElement('div');
  treeParameters.id = 'tree-parameters';
  treeParameters.append(...parametersTab.children);
  parametersTab.appendChild(treeParameters);
  const organismParameters = document.createElement('div');
  organismParameters.id = 'organism-parameters';
  organismParameters.hidden = true;
  parametersTab.appendChild(organismParameters);

  const modeStatus = document.createElement('p');
  modeStatus.className = 'mode-status'; modeStatus.setAttribute('role', 'status');
  function regenerateOrganism(refit = false) {
    const start = performance.now(); modes.regenerate(); lastBuildMs = performance.now() - start;
    if (refit) modes.fit(); updateInfoDisplays();
  }
  function buildOrganismControls() {
    organismParameters.replaceChildren();
    const mode = modes.mode, recipe = modes.recipe;
    const section = createSection('Presets', 'swatch', true);
    section.add(createSelect('Preset', Object.fromEntries(Object.keys(presets[mode]).map(name => [name, name])), recipe.preset, name => {
      modes.setRecipe(newRecipe(mode, name)); regenerateOrganism(true); buildOrganismControls();
    }));
    const seed = createSlider('Seed', recipe.parameters.seed, 0, 65536, 1, value => { recipe.parameters.seed = value; regenerateOrganism(); });
    section.add(seed);
    section.add(createButton('Random Seed', 'dice', () => { recipe.parameters.seed = Math.floor(Math.random() * 65536); seed.setValue(recipe.parameters.seed); regenerateOrganism(); }));
    organismParameters.appendChild(section.element);
    const shape = createSection(mode === 'plant' ? 'Plant Shape' : 'Creature Shape', 'tree', true);
    const shapeFields = mode === 'creature' ? Object.fromEntries(speciesFields[recipe.parameters.species].map(key => [key, fields.creature[key]])) : fields[mode];
    for (const [key, [label, min, max, step]] of Object.entries(shapeFields)) {
      shape.add(createSlider(label, recipe.parameters[key], min, max, step, value => { recipe.parameters[key] = value; regenerateOrganism(); }));
    }
    for (const [key, label] of [['color', 'Primary'], ['accent', 'Accent']]) {
      shape.add(createColorPicker(label, parseInt(recipe.parameters[key].slice(1), 16), value => { recipe.parameters[key] = '#' + value.toString(16).padStart(6, '0'); regenerateOrganism(); }));
    }
    shape.add(createButton('Fit View', 'videoCamera', () => modes.fit()));
    organismParameters.appendChild(shape.element);
    if (mode === 'creature') {
      const animation = createSection('Rig & Animation', 'videoCamera', true);
      const locomotion = recipe.parameters.species === 'snake' ? 'Slither' : recipe.parameters.species === 'fish' ? 'Swim' : 'Walk';
      animation.add(createSelect('Animation', { [locomotion]: locomotion, Idle: 'Idle', 'Rest pose': 'Rest' }, modes.playback.clip, value => modes.setClip(value)));
      animation.add(createToggle('Playing', modes.playback.playing, value => modes.playback.playing = value));
      for (const key of ['gaitSpeed', ...(locomotion === 'Walk' ? ['stride'] : []), 'sway']) {
        const [label, min, max, step] = fields.creature[key];
        animation.add(createSlider(label, recipe.parameters[key], min, max, step, value => { recipe.parameters[key] = value; regenerateOrganism(); }));
      }
      animation.add(createToggle('Show Rig', modes.playback.showRig, value => { modes.playback.showRig = value; modes.refreshStage(); }));
      animation.add(createToggle('Studio View', modes.playback.studio, value => { modes.playback.studio = value; modes.refreshStage(); }));
      organismParameters.appendChild(animation.element);
    }
    modeStatus.id = 'organism-status';
    modeStatus.textContent = mode === 'plant' ? 'Procedural foliage and flowers.' : `${modes.model.userData.rigBones} bones · skinned mesh · Idle + ${modes.model.userData.locomotion}. GLB includes the rig and both clips. Mesh detail: 0 draft / 1 balanced / 2 fine.`;
    organismParameters.appendChild(modeStatus);
  }
  function setMode(mode) {
    if (!modes) return;
    const started = performance.now();
    modes.switchTo(mode);
    forestPreview.setActive(mode === 'tree');
    treeTraits.setActive(mode === 'tree');
    modes.refreshStage();
    forestSection.element.hidden = mode !== 'tree';
    lastBuildMs = mode === 'tree' ? null : performance.now() - started;
    const isTree = mode === 'tree';
    treeParameters.hidden = !isTree; organismParameters.hidden = isTree;
    modeControl.querySelector('input').value = modeNames.indexOf(mode);
    modeControl.querySelector('input').setAttribute('aria-valuetext', mode[0].toUpperCase() + mode.slice(1));
    modeControl.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    tabNav.querySelector('[data-tab="parameters"] .tab-label').textContent = mode[0].toUpperCase() + mode.slice(1);
    lodSwitcher.hidden = !isTree; exportLodsBtn.element.hidden = !isTree; gameDataBtn.element.hidden = !isTree;
    if (!isTree) buildOrganismControls();
    updateInfoDisplays();
  }
  modeControl.querySelector('input').addEventListener('input', event => setMode(modeNames[Number(event.target.value)]));
  modeControl.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

  // ----- Camera Section -----
  const cameraSection = createSection('Camera', 'videoCamera', false);

  const autoRotateToggle = createToggle('Auto Rotate', orbitControls.autoRotate, (val) => {
    orbitControls.autoRotate = val;
  });
  cameraSection.add(autoRotateToggle);
  controls.push({ control: autoRotateToggle, update: () => autoRotateToggle.setValue(orbitControls.autoRotate) });

  const rotateSpeedSlider = createSlider('Rotate Speed', orbitControls.autoRotateSpeed, 0, 2, 0.1, (val) => {
    orbitControls.autoRotateSpeed = val;
  });
  cameraSection.add(rotateSpeedSlider);
  controls.push({ control: rotateSpeedSlider, update: () => rotateSpeedSlider.setValue(orbitControls.autoRotateSpeed) });

  parametersTab.appendChild(cameraSection.element);

  // ----- Environment Section -----
  const environmentSection = createSection('Environment', 'sun', false);

  const sunAzimuthSlider = createSlider('Sun Angle', environment.skybox.sunAzimuth, 0, 360, 1, (val) => {
    environment.skybox.sunAzimuth = val;
  });
  environmentSection.add(sunAzimuthSlider);
  controls.push({ control: sunAzimuthSlider, update: () => sunAzimuthSlider.setValue(environment.skybox.sunAzimuth) });

  const grassCountSlider = createSlider('Grass Count', environment.grass.instanceCount, 0, 25000, 100, (val) => {
    environment.grass.instanceCount = val;
  });
  environmentSection.add(grassCountSlider);
  controls.push({ control: grassCountSlider, update: () => grassCountSlider.setValue(environment.grass.instanceCount) });

  const forestSection = createSubSection('Forest Preview', true);
  forestSection.element.id = 'forest-preview-controls';
  const editedForestToggle = createToggle('Edited Trees', forestPreview.settings.enabled, value => forestPreview.configure({ enabled: value }));
  const surroundToggle = createToggle('Surround Tree', forestPreview.settings.surround, value => forestPreview.configure({ surround: value }));
  forestSection.add(editedForestToggle);
  forestSection.add(surroundToggle);
  forestSection.add(createSlider('Tree Spacing', forestPreview.settings.spacing, 10, 100, 5, value => forestPreview.configure({ spacing: value })));
  forestSection.add(createSlider('Forest Size', forestPreview.settings.rings, 1, 4, 1, value => forestPreview.configure({ rings: value })));
  forestSection.add(createButton('Fit Forest', 'videoCamera', () => forestPreview.fit()));
  const forestInfo = document.createElement('p');
  forestInfo.className = 'mode-status'; forestInfo.id = 'forest-preview-status'; forestInfo.setAttribute('role', 'status');
  forestSection.add(forestInfo);
  forestPreview.onChange = () => {
    const { enabled, surround, spacing, rings } = forestPreview.settings;
    const count = (2 * rings + 1) ** 2 - 1;
    forestInfo.textContent = enabled ? `${count} copies · ${spacing} units apart · ${surround ? 'surrounding cluster' : 'background'} · automatic LODs${forestPreview.dirty ? ' · Updating copies…' : ''}` : 'Standard background. Enable Edited Trees to preview copies. Size 1 starts with 8 neighbours; size 4 has 80.';
    surroundToggle.element.querySelector('button').disabled = !enabled;
    forestSection.element.querySelectorAll('input, .panel-button').forEach(control => control.disabled = !enabled);
  };
  forestPreview.onChange();
  environmentSection.add(forestSection);

  parametersTab.appendChild(environmentSection.element);

  // ----- Info Section -----
  const infoSection = createSection('Info', 'info', false);

  const vertexDisplay = createDisplay('Vertices', tree.vertexCount, (v) => Math.round(v).toLocaleString());
  infoSection.add(vertexDisplay);

  const triangleDisplay = createDisplay('Triangles', tree.triangleCount, (v) => Math.round(v).toLocaleString());
  infoSection.add(triangleDisplay);

  const versionDisplay = createDisplay('Version', version);
  infoSection.add(versionDisplay);

  const aboutBtn = createButton('About', 'info', () => {
    document.getElementById('aboutOverlay').classList.add('active');
  });
  infoSection.add(aboutBtn);

  parametersTab.appendChild(infoSection.element);

  function updateInfoDisplays() {
    const { vertices, triangles } = displayedCounts();
    vertexDisplay.setValue(vertices);
    triangleDisplay.setValue(triangles);
    statsVertices.textContent = Math.round(vertices).toLocaleString();
    statsTriangles.textContent = Math.round(triangles).toLocaleString();
    statsBuildTime.textContent = lastBuildMs == null ? '–' : Math.max(1, Math.round(lastBuildMs)).toString();
    pulseStat(statsTriangles);
    pulseStat(statsVertices);
    pulseStat(statsBuildTime);
  }

  // ============================================================================
  // Export Tab Content
  // ============================================================================

  const exportSection = createSection('Save & Load', 'folder', true);

  const savePresetBtn = createButton('Save Preset', 'document', () => {
    const link = document.getElementById('downloadLink');
    const json = JSON.stringify(modes.mode === 'tree' ? tree.options : modes.recipe, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    link.href = URL.createObjectURL(blob);
    link.download = `${modes.mode}.json`;
    link.click();
  });
  exportSection.add(savePresetBtn);

  const loadPresetBtn = createButton('Load Preset', 'folderOpen', () => {
    document.getElementById('fileInput').click();
  });
  exportSection.add(loadPresetBtn);

  exportTab.appendChild(exportSection.element);

  const exportModelsSection = createSection('Export Models', 'cubeTransparent', true);

  /**
   * GLTFExporter aborts on textures whose image never loaded (e.g. the
   * texture file is missing on disk). Rendering tolerates them, so strip
   * them from the materials for the duration of an export and restore after.
   * @param {THREE.Object3D} root
   * @returns {() => void} restore function
   */
  function stripBrokenTextures(root) {
    const restores = [];
    root.traverse((o) => {
      const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const material of materials) {
        for (const key of ['map', 'aoMap', 'normalMap', 'roughnessMap', 'metalnessMap']) {
          const texture = material[key];
          if (texture?.isTexture && !texture.image) {
            restores.push(() => { material[key] = texture; });
            material[key] = null;
          }
        }
      }
    });
    return () => restores.forEach((restore) => restore());
  }

  const exportGlbBtn = createButton('Export GLB (Full Detail)', 'download', async ({ setStatus }) => {
    setStatus('Exporting GLB…');
    // Export at full detail regardless of the active LOD preview
    const restoreLevel = previewLevel;
    if (restoreLevel !== 0) {
      setPreviewLevel(0);
    }
    let prepared, restoreTextures = () => {};
    try {
      await paint();
      prepared = modes.prepareExport();
      restoreTextures = stripBrokenTextures(prepared.model);
      const glb = await new Promise((resolve, reject) =>
        exporter.parse(prepared.model, resolve, reject, { binary: true, animations: prepared.model.animations ?? [] }),
      );
      const blob = new Blob([glb], { type: 'application/octet-stream' });
      const link = document.getElementById('downloadLink');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${modes.mode}.glb`;
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      restoreTextures();
      prepared?.dispose();
      if (restoreLevel !== 0) {
        setPreviewLevel(restoreLevel);
      }
    }
  });
  exportModelsSection.add(exportGlbBtn);
  const gameDataBtn = createButton('Export Tree Game Data', 'document', async () => {
    await paint();
    try { const prepared = treeTraits.prepareBreakableExport();
      const link = document.getElementById('downloadLink'); link.href = URL.createObjectURL(new Blob([JSON.stringify(prepared.manifest,null,2)],{type:'application/json'})); link.download='tree-breakable.json'; link.click(); prepared.dispose();
    } catch(error) { chopStatus.textContent=error.message; }
  });
  exportModelsSection.add(gameDataBtn);


  const exportLodsBtn = createButton('Export LODs (ZIP)', 'archive', async ({ setStatus }) => {
    const restoreTextures = stripBrokenTextures(getModel());
    try {
      const files = {};
      for (let i = 0; i < Tree.defaultLODLevels.length; i++) {
        setStatus(`Exporting LOD ${i + 1}/${Tree.defaultLODLevels.length}…`);
        await paint();

        const { detail } = Tree.defaultLODLevels[i];
        const { branches, leaves } = tree.createGeometry(detail ?? {});
        if (tree.branchesMesh.material.normalMap && branches.index.count) branches.computeTangents();

        try {
          const branchesMesh = new THREE.Mesh(branches, tree.branchesMesh.material);
          branchesMesh.name = `Branches_LOD${i}`;
          const leavesMesh = new THREE.Mesh(leaves, tree.leavesMesh.material);
          leavesMesh.name = `Leaves_LOD${i}`;
          const group = new THREE.Group();
          group.name = `Tree_LOD${i}`;
          group.add(branchesMesh, leavesMesh);
          const roots = treeTraits.rootExport(i); if (roots) group.add(roots);

          const glb = await new Promise((resolve, reject) =>
            exporter.parse(group, resolve, reject, { binary: true }),
          );
          files[`tree_LOD${i}.glb`] = new Uint8Array(glb);
          if (roots) roots.geometry.dispose();
        } finally {
          branches.dispose();
          leaves.dispose();
        }
      }

      setStatus('Zipping…');
      await paint();

      const blob = new Blob([zipSync(files)], { type: 'application/zip' });
      const link = document.getElementById('downloadLink');
      link.href = URL.createObjectURL(blob);
      link.download = 'tree_lods.zip';
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      restoreTextures();
    }
  });
  exportModelsSection.add(exportLodsBtn);

  const exportPngBtn = createButton('Export PNG', 'photo', async ({ setStatus }) => {
    setStatus('Exporting PNG…');
    await paint();

    renderer.setClearColor(0, 0);
    const fog = scene.fog;
    const background = scene.background;
    scene.background = null;
    scene.fog = null;

    const visibility = new Map();
    scene.traverse((o) => {
      visibility.set(o, o.visible);
      if (o.name === 'Skybox') {
        o.material.side = THREE.FrontSide;
      } else if (o.isMesh || o.isLineSegments) {
        o.visible = false;
      }
    });
    getModel().traverse((o) => o.visible = true);

    try {
      renderer.render(scene, camera);

      const link = document.getElementById('downloadLink');
      link.href = renderer.domElement.toDataURL('image/png');
      link.download = `${modes.mode}.png`;
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      renderer.setClearColor(0);
      scene.fog = fog;
      scene.background = background;
      scene.traverse((o) => {
        if (o.name === 'Skybox') {
          o.material.side = THREE.BackSide;
        }
        o.visible = visibility.get(o);
      });
    }
  });
  exportModelsSection.add(exportPngBtn);

  exportTab.appendChild(exportModelsSection.element);

  // Panel footer with course link
  const footer = document.createElement('div');
  footer.className = 'panel-footer';
  footer.innerHTML = `
    <p class="panel-footer-heading">Enjoying EZ-Tree? Try my other assets</p>
    <a href="https://threejsroadmap.com/assets/threejs-water-pro?utm_source=eztree" target="_blank" class="panel-footer-link">
      🌊 Three.js Water Pro
    </a>
    <a href="https://threejsroadmap.com/assets/threejs-sky-pro?utm_source=eztree" target="_blank" class="panel-footer-link">
      ☁️ Three.js Sky Pro
    </a>
  `;
  panel.appendChild(footer);

  // Add panel to container
  container.appendChild(panel);

  // File input handler
  const fileInput = document.getElementById('fileInput');
  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);

  newFileInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          if ((data.version === 1 || data.version === 2) && data.mode) {
            const recipe = validateRecipe(data);
            if (recipe.mode === 'tree') throw new Error('Use an original tree preset for Tree mode.');
            modes.setRecipe(recipe); setMode(recipe.mode); regenerateOrganism(true); buildOrganismControls();
          } else {
            if (!data.branch || !data.leaves || !data.bark) throw new Error('Not an EZ-Tree preset.');
            setMode('tree'); tree.options.copy(data); onChange(); refreshAllControls();
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };
      reader.onerror = function (e) {
        console.error('Error reading file:', e);
      };
      reader.readAsText(file);
    }
    // Reset file input
    newFileInput.value = '';
  });

  // Refresh all controls to match current tree options
  function refreshAllControls() {
    controls.forEach(({ update }) => update());
    updateInfoDisplays();
  }

  // Initialize the stats overlay with the current tree's counts
  updateInfoDisplays();

  // Mobile expand/collapse functionality
  setupMobileToggle(panel, header);
}

/**
 * Sets up the mobile bottom sheet: the whole header is the tap target,
 * and the panel starts collapsed so the scene stays the hero.
 */
function setupMobileToggle(panel, header) {
  const mobileQuery = window.matchMedia('(max-width: 800px)');

  header.addEventListener('click', () => {
    if (!mobileQuery.matches) return;
    panel.classList.toggle('collapsed');
  });

  if (mobileQuery.matches) {
    panel.classList.add('collapsed');
  }
}
