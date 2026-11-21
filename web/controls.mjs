import {validDay} from '../knowledge/schema.mjs';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const controls = new Map();
const dialogAnimations = new WeakMap();
const running = new WeakMap();
let active = null;
const closingControls = new Set();
const ease = 'cubic-bezier(.16,1,.3,1)';
const node = (tag, css, text) => {
  const element = document.createElement(tag);
  if (css) element.className = css;
  if (text != null) element.textContent = text;
  return element;
};
const svg = name => {
  const element = document.createElementNS('http://www.w3.org/2000/svg','svg');
  element.setAttribute('class','icon');
  element.setAttribute('aria-hidden','true');
  const use = document.createElementNS('http://www.w3.org/2000/svg','use');
  use.setAttribute('href','#i-' + name);
  element.append(use);
  return element;
};
const action = (css, text, callback) => {
  const element = node('button',css,text);
  element.type = 'button';
  element.addEventListener('click',callback);
  return element;
};
const focus = element => element?.isConnected && element.focus({preventScroll:true});
const day = value => new Date(value + 'T12:00:00Z');
const iso = value => value.toISOString().slice(0,10);
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
const shiftDay = (value,amount) => {
  const date = day(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return iso(date);
};
const monthOf = value => value.slice(0,7) + '-01';
const nextMonth = (value,amount) => {
  const date = day(monthOf(value));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return iso(date);
};
function play(element,frames,options = {}) {
  if (!element?.animate || reduced.matches) return null;
  running.get(element)?.cancel();
  const animation = element.animate(frames,{duration:180,easing:ease,...options});
  running.set(element,animation);
  animation.finished.catch(()=>{}).finally(()=>{
    if (running.get(element) === animation) running.delete(element);
  });
  return animation;
}
function labelFor(input) {
  return input.getAttribute('aria-label') ||
    [...(input.closest('label')?.childNodes || [])].filter(part=>part.nodeType === 3).map(part=>part.textContent).join('').trim() ||
    input.name || '选择';
}
function ownerFor(anchor) { return anchor.closest('dialog[open]') || document.body; }
function discardClosing() {
  for (const record of closingControls) {
    record.element.getAnimations().forEach(animation=>animation.cancel());
    if (record.element.matches(':popover-open')) record.element.hidePopover();
    record.element.remove();
  }
  closingControls.clear();
}
function position(record) {
  if (!record.anchor.isConnected) { closeControl({animate:false}); return; }
  const anchor = record.anchor.getBoundingClientRect();
  const width = Math.min(Math.max(record.minWidth || 186,anchor.width),window.innerWidth - 28);
  record.element.style.width = width + 'px';
  record.element.style.maxHeight = Math.min(record.maxHeight || 360,window.innerHeight - 28) + 'px';
  const height = record.element.getBoundingClientRect().height;
  const below = window.innerHeight - anchor.bottom - 10;
  const above = anchor.top - 10;
  const side = below >= height || below >= above ? 'bottom' : 'top';
  const top = side === 'bottom' ? Math.min(anchor.bottom + 9,window.innerHeight-height-14) : Math.max(14,anchor.top-height-9);
  const left = Math.min(Math.max(14,record.align === 'right' ? anchor.right-width : anchor.left),window.innerWidth-width-14);
  Object.assign(record.element.style,{left:left+'px',top:Math.max(14,top)+'px'});
  record.element.dataset.side = side;
  record.element.style.transformOrigin = side === 'bottom' ? '50% 0' : '50% 100%';
}
function openControl(record) {
  closeControl({animate:false,restoreFocus:false});
  active = record;
  record.element.setAttribute('popover','manual');
  record.element.dataset.controlKind = record.kind;
  record.element.style.visibility = 'hidden';
  ownerFor(record.anchor).append(record.element);
  if (record.element.showPopover) record.element.showPopover();
  else record.element.dataset.fallback = 'true';
  position(record);
  record.element.style.visibility = '';
  record.expanded.setAttribute('aria-expanded','true');
  const fromTop = record.element.dataset.side === 'bottom';
  play(record.element,[
    {opacity:.25,transform:'translateY('+(fromTop?-5:5)+'px) scale(.985)',clipPath:'inset('+(fromTop?'0 0 18% 0':'18% 0 0 0')+' round 18px)'},
    {opacity:1,transform:'none',clipPath:'inset(0 0 0 0 round 18px)'}
  ],{duration:210});
}
export function closeControl({animate = true,restoreFocus = false} = {}) {
  if (!animate) discardClosing();
  const record = active;
  if (!record) return Promise.resolve();
  active = null;
  record.expanded.setAttribute('aria-expanded','false');
  record.expanded.removeAttribute('aria-activedescendant');
  if (restoreFocus) focus(record.anchor);
  record.element.inert = true;
  const remove = () => {
    if (record.element.matches(':popover-open')) record.element.hidePopover();
    record.element.remove();
    closingControls.delete(record);
  };
  const animation = animate ? play(record.element,[
    {opacity:getComputedStyle(record.element).opacity,transform:getComputedStyle(record.element).transform,clipPath:getComputedStyle(record.element).clipPath},
    {opacity:0,transform:'translateY('+(record.element.dataset.side === 'top'?4:-4)+'px) scale(.985)',clipPath:'inset('+(record.element.dataset.side === 'top'?'20% 0 0 0':'0 0 20% 0')+' round 18px)'}
  ],{duration:140}) : null;
  if (!animation) { remove(); return Promise.resolve(); }
  closingControls.add(record);
  return animation.finished.catch(()=>{}).then(remove);
}
function updateChoiceValue(state) {
  const text = state.select.selectedOptions[0]?.textContent || '';
  state.trigger.disabled = state.select.disabled;
  state.trigger.setAttribute('aria-label',state.label + '：' + text);
  if (state.current.textContent === text) return;
  const previous = state.current.textContent;
  state.current.textContent = text;
  if (!previous || reduced.matches) return;
  const old = node('span','select-outgoing',previous);
  old.setAttribute('aria-hidden','true');
  state.valueFrame.append(old);
  const leaving = play(old,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-8px)'}],{duration:130});
  if (leaving) leaving.finished.catch(()=>{}).finally(()=>old.remove()); else old.remove();
  play(state.current,[{opacity:.2,transform:'translateY(8px)',filter:'blur(1px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:180});
}
function optionPrefix(select,option) {
  if (['全班','A组','B组'].includes(option.value)) {
    if (option.value === '全班') return svg('users');
    return node('span','option-initial',option.value[0]);
  }
  const icons = {student:'book',teacher:'users',auto:'spark',current:'check',compare:'book',active:'check',all:'folder',scheduled:'clock',uncertain:'help'};
  return svg(icons[option.value] || 'file');
}
function highlight(record,index,{scroll = true} = {}) {
  if (!record.items.length) return;
  const candidates = record.items.map((item,i)=>!item.disabled?i:-1).filter(i=>i>=0);
  if (!candidates.length) return;
  if (!candidates.includes(index)) index = candidates[0];
  record.index = index;
  record.items.forEach((item,i)=>item.classList.toggle('is-highlighted',i===index));
  const item = record.items[index];
  record.expanded.setAttribute('aria-activedescendant',item.id);
  const y = item.offsetTop;
  record.indicator.style.transform = 'translateY('+y+'px)';
  record.indicator.style.height = item.offsetHeight+'px';
  record.indicator.hidden = false;
  if (scroll) item.scrollIntoView({block:'nearest'});
}
function moveChoice(record,direction) {
  if (!record.items.length) return;
  let index = record.index;
  for (let count=0;count<record.items.length;count++) {
    index = (index+direction+record.items.length)%record.items.length;
    if (!record.items[index].disabled) { highlight(record,index); return; }
  }
}
function fillOptions(record,options,current,choose,prefix) {
  record.items = options.map((option,index)=>{
    const item = action('picker-option','',()=>choose(option));
    item.id = record.element.id+'-option-'+index;
    item.setAttribute('role','option');
    item.setAttribute('aria-selected',String(option.value===current));
    item.dataset.value = option.value;
    item.tabIndex = -1;
    item.disabled = Boolean(option.disabled);
    if (prefix) {
      const leading = node('span','option-leading');
      leading.append(prefix(option)); item.append(leading);
    }
    item.append(node('span','option-label',option.text));
    const check = svg('check'); check.classList.add('option-check'); item.append(check);
    item.addEventListener('pointerdown',event=>event.preventDefault());
    item.addEventListener('pointerenter',()=>highlight(record,index,{scroll:false}));
    return item;
  });
  record.indicator = node('span','option-indicator');
  record.indicator.hidden = true;
  record.indicator.setAttribute('aria-hidden','true');
  record.list.replaceChildren(record.indicator,...record.items);
}
function openSelect(state,direction = 0) {
  if (state.select.disabled) return;
  if (active?.controller === state) { closeControl({restoreFocus:true}); return; }
  const element = node('div','control-popover select-popover');
  element.id = state.trigger.getAttribute('aria-controls');
  element.setAttribute('role','listbox');
  element.setAttribute('aria-label',state.label);
  const list = node('div','picker-options');
  list.setAttribute('role','presentation');
  element.append(list);
  const record = {kind:'select',controller:state,element,list,anchor:state.trigger,expanded:state.trigger,items:[],index:0,align:state.select.id==='role-picker'?'right':'left'};
  const options = [...state.select.options].map(option=>({value:option.value,text:option.textContent,disabled:option.disabled}));
  fillOptions(record,options,state.select.value,option=>{
    state.select.value = option.value;
    record.items.forEach(item=>item.setAttribute('aria-selected',String(item.dataset.value===option.value)));
    updateChoiceValue(state);
    state.select.dispatchEvent(new Event('input',{bubbles:true}));
    state.select.dispatchEvent(new Event('change',{bubbles:true}));
    closeControl({restoreFocus:true});
  },option=>optionPrefix(state.select,option));
  openControl(record);
  const current = options.findIndex(option=>option.value===state.select.value);
  highlight(record,current<0?0:current);
  if (direction) moveChoice(record,direction);
}
function installSelect(select,index) {
  if (controls.has(select)) return;
  if (!select.id) select.id = 'import-' + (select.name || index);
  const label = labelFor(select);
  const wrapper = node('span','custom-select');
  wrapper.dataset.selectId = select.id;
  select.before(wrapper); wrapper.append(select);
  select.classList.add('control-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden','true');
  const trigger = action('select-trigger','',()=>openSelect(state));
  trigger.id = 'select-'+select.id+'-trigger';
  trigger.setAttribute('role','combobox');
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-controls','select-'+select.id+'-menu');
  const valueFrame = node('span','select-value-frame');
  const current = node('span','select-value');
  valueFrame.append(current);
  const chevron = svg('chevron'); chevron.classList.add('select-chevron');
  trigger.append(valueFrame,chevron); wrapper.append(trigger);
  const state = {kind:'select',select,label,wrapper,trigger,valueFrame,current,buffer:'',typedAt:0};
  controls.set(select,state);
  trigger.addEventListener('keydown',event=>{
    const open = active?.controller===state;
    if (event.key==='ArrowDown' || event.key==='ArrowUp') {
      event.preventDefault();
      if (!open) openSelect(state);
      else moveChoice(active,event.key==='ArrowDown'?1:-1);
    } else if (['Home','End'].includes(event.key)) {
      event.preventDefault();
      if (!open) openSelect(state);
      highlight(active,event.key==='Home'?0:active.items.length-1);
    } else if (['Enter',' '].includes(event.key) && open) {
      event.preventDefault(); active.items[active.index]?.click();
    } else if (event.key==='Tab' && open) active.items[active.index]?.click();
    else if (event.key.length===1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && event.key!==' ') {
      event.preventDefault();
      if (!open) openSelect(state);
      const now = performance.now();
      state.buffer = now-state.typedAt>650 ? event.key : state.buffer+event.key;
      state.typedAt = now;
      const index = active.items.findIndex(item=>!item.disabled && item.textContent.trim().toLowerCase().startsWith(state.buffer.toLowerCase()));
      if (index>=0) highlight(active,index);
    }
  });
  select.addEventListener('change',()=>updateChoiceValue(state));
  updateChoiceValue(state);
}
function commitDate(state,value) {
  state.input.value = value;
  state.input.dispatchEvent(new Event('input',{bubbles:true}));
  state.input.dispatchEvent(new Event('change',{bubbles:true}));
  syncControls();
  closeControl({restoreFocus:true});
}
function openDate(state) {
  if (active?.controller===state) { closeControl({restoreFocus:true}); return; }
  const value = validDay(state.input.value) ? state.input.value : today();
  const element = node('div','control-popover date-popover');
  element.id = state.trigger.getAttribute('aria-controls');
  element.setAttribute('role','dialog');
  element.setAttribute('aria-label','选择'+state.label);
  const record = {kind:'date',controller:state,element,anchor:state.trigger,expanded:state.trigger,minWidth:300,maxHeight:420,month:monthOf(value),focused:value};
  const head = node('div','picker-month-heading');
  const title = node('h3');
  title.id = element.id+'-title';
  title.setAttribute('aria-live','polite');
  const changeMonth = (amount,restore = false) => {
    record.month = nextMonth(record.month,amount);
    const target = new Date(day(record.month));
    const last = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    target.setUTCDate(Math.min(Number(record.focused.slice(8)),last));
    record.focused = iso(target);
    render();
    animateWeek(grid,amount);
    if (restore) focus(grid.querySelector('[data-date="'+record.focused+'"]'));
  };
  const previous = action('picker-month-button','',()=>changeMonth(-1));
  previous.setAttribute('aria-label','上一月');
  const left = svg('chevron'); left.classList.add('rotate'); previous.append(left);
  const next = action('picker-month-button','',()=>changeMonth(1));
  next.setAttribute('aria-label','下一月'); next.append(svg('chevron'));
  head.append(previous,title,next);
  const weekdays = node('div','picker-weekdays');
  for (const text of ['一','二','三','四','五','六','日']) weekdays.append(node('span','',text));
  const grid = node('div','picker-calendar-grid');
  grid.setAttribute('role','grid');
  grid.setAttribute('aria-labelledby',title.id);
  const footer = node('div','picker-date-footer');
  const current = action('picker-date-action','今天',()=>commitDate(state,today()));
  current.prepend(svg('calendar')); footer.append(current);
  if (!state.input.required) footer.append(action('picker-date-action','清除',()=>commitDate(state,'')));
  element.append(head,weekdays,grid,footer);
  function render() {
    title.textContent = record.month.slice(0,4)+' 年 '+Number(record.month.slice(5,7))+' 月';
    const start = shiftDay(record.month,-((day(record.month).getUTCDay()+6)%7));
    grid.replaceChildren(...Array.from({length:42},(_,index)=>{
      const date = shiftDay(start,index);
      const chosen = date===state.input.value;
      const cell = action('picker-day'+(date.slice(0,7)!==record.month.slice(0,7)?' outside-month':'')+(date===today()?' is-today':''),'',()=>commitDate(state,date));
      cell.textContent = String(Number(date.slice(8)));
      cell.dataset.date = date;
      cell.setAttribute('role','gridcell');
      cell.setAttribute('aria-selected',String(chosen));
      cell.setAttribute('aria-label',date.replaceAll('-',' / '));
      cell.tabIndex = date===record.focused?0:-1;
      cell.disabled = Boolean((state.input.min && date<state.input.min)||(state.input.max && date>state.input.max));
      cell.addEventListener('keydown',event=>{
        const offsets = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-((day(date).getUTCDay()+6)%7),End:6-((day(date).getUTCDay()+6)%7)};
        if (event.key in offsets) {
          event.preventDefault();
          record.focused = shiftDay(date,offsets[event.key]);
          const before = record.month;
          record.month = monthOf(record.focused);
          render();
          if (before!==record.month) animateWeek(grid,before<record.month?1:-1);
          focus(grid.querySelector('[data-date="'+record.focused+'"]'));
        } else if (event.key==='PageUp' || event.key==='PageDown') {
          event.preventDefault(); changeMonth(event.key==='PageUp'?-1:1,true);
        }
      });
      return cell;
    }));
  }
  render(); openControl(record);
  focus(grid.querySelector('[data-date="'+record.focused+'"]'));
}
function installDate(input,index) {
  if (controls.has(input)) return;
  if (!input.id) input.id = 'import-date-'+(input.name || index);
  const label = labelFor(input);
  const field = node('span','date-field');
  input.before(field); field.append(input);
  const trigger = action('date-trigger','',()=>openDate(state));
  trigger.id = 'date-'+input.id+'-trigger';
  trigger.append(svg('calendar'));
  trigger.setAttribute('aria-label','选择'+label);
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-controls','date-'+input.id+'-menu');
  field.append(trigger);
  const state = {kind:'date',input,label,field,trigger};
  controls.set(input,state);
  input.addEventListener('keydown',event=>{
    if ((event.altKey && event.key==='ArrowDown') || event.key==='F4') {
      event.preventDefault(); openDate(state);
    }
  });
}
function openSuggestions(state) {
  const query = state.input.value.trim().toLowerCase();
  const options = [...state.source.options].map(option=>({value:option.value,text:option.value})).filter(option=>!query || option.value.toLowerCase().includes(query));
  if (!options.length) { if(active?.controller===state)closeControl(); return; }
  if (active?.controller===state) {
    fill(active,options); position(active); return;
  }
  const element = node('div','control-popover suggestion-popover');
  element.id = state.input.getAttribute('aria-controls');
  element.setAttribute('role','listbox');
  element.setAttribute('aria-label','条款主题建议');
  const list = node('div','picker-options');
  list.setAttribute('role','presentation');
  element.append(list);
  const record = {kind:'suggestion',controller:state,element,list,items:[],index:0,anchor:state.input,owner:state.field,expanded:state.input,minWidth:state.field.offsetWidth};
  fill(record,options); openControl(record); highlight(record,0);
  function fill(target,entries) {
    fillOptions(target,entries,state.input.value,option=>{
      state.input.value = option.value;
      state.input.dispatchEvent(new Event('input',{bubbles:true}));
      closeControl({restoreFocus:true});
    },()=>svg('file'));
    highlight(target,0);
  }
}
function installSuggestions(input) {
  const source = document.getElementById(input.getAttribute('list'));
  if (!source) return;
  input.removeAttribute('list');
  input.autocomplete = 'off';
  const field = node('span','topic-field');
  input.before(field); field.append(input);
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-controls','topic-suggestion-menu');
  const state = {kind:'suggestion',input,source,field};
  const trigger = action('topic-trigger','',()=>{
    if (active?.controller===state) closeControl({restoreFocus:true});
    else { focus(input); openSuggestions(state); }
  });
  trigger.append(svg('chevron'));
  trigger.setAttribute('aria-label','选择条款主题');
  field.append(trigger);
  controls.set(input,state);
  input.addEventListener('input',()=>openSuggestions(state));
  input.addEventListener('keydown',event=>{
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (active?.controller!==state) openSuggestions(state);
      else moveChoice(active,event.key==='ArrowDown'?1:-1);
    } else if (event.key==='Enter' && active?.controller===state) {
      event.preventDefault(); active.items[active.index]?.click();
    } else if (event.key==='Tab' && active?.controller===state) closeControl();
  });
}
export function syncControls() {
  for (const state of controls.values()) {
    if (state.kind==='select') updateChoiceValue(state);
    else if (state.kind==='date') state.trigger.setAttribute('aria-label','选择'+state.label+(state.input.value?'，当前 '+state.input.value:''));
  }
}
export function installControls() {
  document.querySelectorAll('select').forEach(installSelect);
  document.querySelectorAll('input[type="date"]').forEach(installDate);
  const topic = document.querySelector('input[list="topic-list"]');
  if (topic) installSuggestions(topic);
  document.querySelectorAll('form').forEach(form=>form.addEventListener('reset',()=>queueMicrotask(syncControls)));
  document.addEventListener('pointerdown',event=>{
    if (active && !active.element.contains(event.target) && !active.anchor.contains(event.target) && !active.owner?.contains(event.target)) closeControl();
  },{capture:true,passive:true});
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape' && active) {
      event.preventDefault(); event.stopImmediatePropagation(); closeControl({restoreFocus:true});
    }
  },true);
  let scheduled = false;
  const reposition = () => {
    if (!active || scheduled) return;
    scheduled = true;
    requestAnimationFrame(()=>{scheduled=false;if(active)position(active);});
  };
  window.addEventListener('resize',reposition);
  window.addEventListener('scroll',reposition,{capture:true,passive:true});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
    if (active?.element.closest('dialog')===dialog) closeControl({animate:false});
  }));
}

export function animateRoute(element,direction = 1) {
  play(element,[{opacity:.45,transform:'translateX('+(direction*9)+'px)',clipPath:'inset(0 0 0 1.5%)'},{opacity:1,transform:'none',clipPath:'inset(0 0 0 0)'}],{duration:210});
}
export function animateBookmark(button) {
  const icon = button?.querySelector('svg');
  if (!icon || reduced.matches) return;
  const saved = button.getAttribute('aria-pressed')==='true';
  const path = icon.querySelector('path') || icon.querySelector('use');
  play(icon,saved?
    [{rotate:'-9deg',scale:.9},{rotate:'4deg',scale:1.08,offset:.55},{rotate:'0deg',scale:1}]:
    [{rotate:'0deg',opacity:1},{rotate:'-7deg',opacity:.45,offset:.4},{rotate:'0deg',opacity:1}],{duration:240});
  if (path) play(path,[{strokeDasharray:'70',strokeDashoffset:saved?'70':'-18'},{strokeDasharray:'70',strokeDashoffset:'0'}],{duration:260});
}
export function animateWeek(element,direction = 1) {
  play(element,[{opacity:.4,transform:'translateX('+(direction*14)+'px)'},{opacity:1,transform:'none'}],{duration:210});
}
export function animateFilteredList(element) {
  if (reduced.matches) return;
  [...element.children].slice(0,6).forEach((item,index)=>{
    play(item,[{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:160,delay:index*14});
  });
}
export function updateCalendarIndicator(container) {
  const target = container.querySelector('.day-button[aria-pressed="true"]');
  const indicator = container.querySelector('.calendar-selection');
  if (!target || !indicator || !container.offsetWidth) return;
  Object.assign(indicator.style,{width:target.offsetWidth+'px',height:target.offsetHeight+'px',transform:'translate('+target.offsetLeft+'px,'+target.offsetTop+'px)'});
}
export function openDialog(dialog) {
  closeControl({animate:false});
  dialogAnimations.get(dialog)?.cancel();
  dialogAnimations.delete(dialog);
  dialog.classList.remove('dialog-closing');
  if (!dialog.open) {
    dialog.showModal();
    const drawer = dialog.classList.contains('source-drawer');
    play(dialog,drawer?
      [{opacity:.75,transform:'translateX(45px)',clipPath:'inset(0 0 0 12% round 25px 0 0 25px)'},{opacity:1,transform:'none',clipPath:'inset(0 0 0 0 round 25px 0 0 25px)'}]:
      [{opacity:.4,transform:'translateY(16px)',filter:'blur(2px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:drawer?280:230});
  }
}
export async function closeDialog(dialog) {
  closeControl({animate:false});
  if (!dialog.open || dialogAnimations.has(dialog)) return;
  dialog.classList.add('dialog-closing');
  const drawer = dialog.classList.contains('source-drawer');
  const animation = play(dialog,[{opacity:1,transform:'none'},{opacity:0,transform:drawer?'translateX(34px)':'translateY(10px)'}],{duration:drawer?180:150});
  if (animation) {
    dialogAnimations.set(dialog,animation);
    await animation.finished.catch(()=>{});
    if (dialogAnimations.get(dialog)!==animation) return;
    dialogAnimations.delete(dialog);
  }
  dialog.close(); dialog.classList.remove('dialog-closing');
}
export function revealSearch(element) {
  play(element,[{opacity:.4,clipPath:'inset(0 0 0 85% round 18px)',transform:'translateY(-3px)'},{opacity:1,clipPath:'inset(0 0 0 0 round 18px)',transform:'none'}],{duration:220});
}
export async function concealSearch(element) {
  const animation = play(element,[{opacity:1,clipPath:'inset(0 0 0 0 round 18px)'},{opacity:0,clipPath:'inset(0 0 0 85% round 18px)'}],{duration:130});
  if (!animation) return true;
  if (animation) await animation.finished.catch(()=>{});
  return running.get(element)===undefined || running.get(element)===animation;
}
export function installMotion() {
  // Press feedback is small; each stateful component owns its richer animation.
  document.addEventListener('pointerdown',event=>{
    if (event.button!==0 || reduced.matches) return;
    const button = event.target.closest('button');
    if (!button || button.disabled || button.closest('.control-popover') || button.matches('.day-button,.select-trigger,.date-trigger,.topic-trigger')) return;
    play(button,[{scale:1},{scale:.975,offset:.35},{scale:1}],{duration:140});
  },{capture:true,passive:true});
  reduced.addEventListener('change',event=>{
    if (!event.matches) return;
    document.getAnimations().forEach(animation=>animation.cancel());
    if (active) { position(active); }
  });
}
