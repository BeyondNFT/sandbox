
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
function noop() { }
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}
// TODO figure out if we still want to support
// shorthand events, or if we want to implement
// a real bubbling mechanism
function bubble(component, event) {
    const callbacks = component.$$.callbacks[event.type];
    if (callbacks) {
        callbacks.slice().forEach(fn => fn(event));
    }
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global);

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev("SvelteDOMInsert", { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev("SvelteDOMRemove", { node });
    detach(node);
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
    else
        dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error(`'target' is a required option`);
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn(`Component was already destroyed`); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

let uid = 1;

function handle_command_message(cmd_data) {
  let action = cmd_data.action;
  let id = cmd_data.cmd_id;
  let handler = this.pending_cmds.get(id);

  if (handler) {
    this.pending_cmds.delete(id);
    if (action === 'cmd_error') {
      let { message, stack } = cmd_data;
      let e = new Error(message);
      e.stack = stack;
      handler.reject(e);
    }

    if (action === 'cmd_ok') {
      handler.resolve(cmd_data.args || 'ok');
    }
  } else {
    console.error('command not found', id, cmd_data, [
      ...this.pending_cmds.keys(),
    ]);
  }
}

function handle_repl_message(event) {
  if (event.source !== this.iframe.contentWindow) return;
  const { action, args } = event.data;

  switch (action) {
    case 'cmd_error':
    case 'cmd_ok':
      return handle_command_message.call(this, event.data);
    case 'fetch_progress':
      return this.handlers.on_fetch_progress(args.remaining);
    case 'error':
      return this.handlers.on_error(event.data);
    case 'unhandledrejection':
      return this.handlers.on_unhandled_rejection(event.data);
    case 'console':
      return this.handlers.on_console(event.data);
    case 'console_group':
      return this.handlers.on_console_group(event.data);
    case 'console_group_collapsed':
      return this.handlers.on_console_group_collapsed(event.data);
    case 'console_group_end':
      return this.handlers.on_console_group_end(event.data);
    default:
      const handler = `on_${action}`;
      if ('function' === typeof this.handlers[handler]) {
        this.handlers[handler](event.data);
      }
  }
}

class Proxy {
  constructor(iframe, handlers) {
    this.iframe = iframe;
    this.handlers = handlers;

    this.pending_cmds = new Map();

    this.handle_event = handle_repl_message.bind(this);
    window.addEventListener('message', this.handle_event, false);
  }

  destroy() {
    window.removeEventListener('message', this.handle_event);
  }

  iframe_command(action, args) {
    return new Promise((resolve, reject) => {
      const cmd_id = uid++;

      this.pending_cmds.set(cmd_id, { resolve, reject });

      this.iframe.contentWindow.postMessage({ action, cmd_id, args }, '*');
    });
  }

  eval(script) {
    return this.iframe_command('eval', { script });
  }

  add_script(script) {
    return this.iframe_command('add_script', script);
  }

  add_script_content(script) {
    return this.iframe_command('add_script_content', script);
  }

  add_style(style) {
    return this.iframe_command('add_style', style);
  }

  add_asset(asset) {
    return this.iframe_command('add_asset', asset);
  }

  handle_links() {
    return this.iframe_command('catch_clicks', {});
  }
}

var srcdoc = "<!DOCTYPE html>\n<html>\n  <head>\n    <style>\n      \n    </style>\n\n    <script>\n      (function () {\n        const local_eval = eval;\n        eval = function () {};\n\n        function handle_message(ev) {\n          let { action, cmd_id } = ev.data;\n          const send_message = (payload) =>\n            parent.postMessage({ ...payload }, ev.origin);\n\n          const send_reply = (payload) => send_message({ ...payload, cmd_id });\n          const send_ok = (args) => send_reply({ action: 'cmd_ok', args });\n          const send_error = (message, stack) =>\n            send_reply({ action: 'cmd_error', message, stack });\n\n          if (action === 'eval') {\n            try {\n              const { script } = ev.data.args;\n              local_eval(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script') {\n            try {\n              const script = document.createElement('script');\n              script.src = ev.data.args;\n              script.onload = () => send_ok();\n              document.body.appendChild(script);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script_content') {\n            try {\n              const script = document.createElement('script');\n              script.text = ev.data.args;\n              script.type = 'text/javascript';\n              document.body.appendChild(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_style') {\n            try {\n              const link = document.createElement('link');\n              link.rel = 'stylesheet';\n              link.href = ev.data.args;\n              link.onload = () => send_ok();\n              document.body.appendChild(link);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'catch_clicks') {\n            try {\n              const top_origin = ev.origin;\n              document.body.addEventListener('click', (event) => {\n                if (event.which !== 1) return;\n                if (event.metaKey || event.ctrlKey || event.shiftKey) return;\n                if (event.defaultPrevented) return;\n\n                // ensure target is a link\n                let el = event.target;\n                while (el && el.nodeName !== 'A') el = el.parentNode;\n                if (!el || el.nodeName !== 'A') return;\n\n                if (\n                  el.hasAttribute('download') ||\n                  el.getAttribute('rel') === 'external' ||\n                  el.target\n                )\n                  return;\n\n                event.preventDefault();\n\n                if (el.href.startsWith(top_origin)) {\n                  const url = new URL(el.href);\n                  if (url.hash[0] === '#') {\n                    window.location.hash = url.hash;\n                    return;\n                  }\n                }\n\n                window.open(el.href, '_blank');\n              });\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n        }\n\n        window.addEventListener('message', handle_message, false);\n\n        window.onerror = function (msg, url, lineNo, columnNo, error) {\n          try {\n            parent.postMessage({ action: 'error', value: error }, '*');\n          } catch (e) {\n            parent.postMessage({ action: 'error', value: msg }, '*');\n            parent.postMessage({ action: 'error', value: error }, '*');\n          }\n        };\n\n        window.addEventListener('unhandledrejection', (event) => {\n          parent.postMessage(\n            { action: 'unhandledrejection', value: event.reason },\n            '*'\n          );\n        });\n\n        let previous = { level: null, args: null };\n\n        ['clear', 'log', 'info', 'dir', 'warn', 'error', 'table'].forEach(\n          (level) => {\n            const original = console[level];\n            console[level] = (...args) => {\n              const stringifiedArgs = stringify(args);\n              if (\n                previous.level === level &&\n                previous.args &&\n                previous.args === stringifiedArgs\n              ) {\n                parent.postMessage(\n                  { action: 'console', level, duplicate: true },\n                  '*'\n                );\n              } else {\n                previous = { level, args: stringifiedArgs };\n\n                try {\n                  parent.postMessage({ action: 'console', level, args }, '*');\n                } catch (err) {\n                  parent.postMessage(\n                    { action: 'console', level: 'unclonable' },\n                    '*'\n                  );\n                }\n              }\n\n              original(...args);\n            };\n          }\n        );\n\n        [\n          { method: 'group', action: 'console_group' },\n          { method: 'groupEnd', action: 'console_group_end' },\n          { method: 'groupCollapsed', action: 'console_group_collapsed' },\n        ].forEach((group_action) => {\n          const original = console[group_action.method];\n          console[group_action.method] = (label) => {\n            parent.postMessage({ action: group_action.action, label }, '*');\n\n            original(label);\n          };\n        });\n\n        const timers = new Map();\n        const original_time = console.time;\n        const original_timelog = console.timeLog;\n        const original_timeend = console.timeEnd;\n\n        console.time = (label = 'default') => {\n          original_time(label);\n          timers.set(label, performance.now());\n        };\n        console.timeLog = (label = 'default') => {\n          original_timelog(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n        };\n        console.timeEnd = (label = 'default') => {\n          original_timeend(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n          timers.delete(label);\n        };\n\n        const original_assert = console.assert;\n        console.assert = (condition, ...args) => {\n          if (condition) {\n            const stack = new Error().stack;\n            parent.postMessage(\n              { action: 'console', level: 'assert', args, stack },\n              '*'\n            );\n          }\n          original_assert(condition, ...args);\n        };\n\n        const counter = new Map();\n        const original_count = console.count;\n        const original_countreset = console.countReset;\n\n        console.count = (label = 'default') => {\n          counter.set(label, (counter.get(label) || 0) + 1);\n          parent.postMessage(\n            {\n              action: 'console',\n              level: 'system-log',\n              args: `${label}: ${counter.get(label)}`,\n            },\n            '*'\n          );\n          original_count(label);\n        };\n\n        console.countReset = (label = 'default') => {\n          if (counter.has(label)) {\n            counter.set(label, 0);\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: `Count for '${label}' does not exist`,\n              },\n              '*'\n            );\n          }\n          original_countreset(label);\n        };\n\n        const original_trace = console.trace;\n\n        console.trace = (...args) => {\n          const stack = new Error().stack;\n          parent.postMessage(\n            { action: 'console', level: 'trace', args, stack },\n            '*'\n          );\n          original_trace(...args);\n        };\n\n        function stringify(args) {\n          try {\n            return JSON.stringify(args);\n          } catch (error) {\n            return null;\n          }\n        }\n      })(this);\n\n      // remove alert, set window context\n      (() => {\n        const original_alert = window.alert;\n        window.alert = function () {};\n\n        window.context = {\n          nft_json: {},\n          config: {},\n          owner: '0x0000000000000000000000000000000000000000',\n        };\n      })(this);\n    </script>\n  </head>\n  <body>\n    <!-- NFTCODE -->\n  </body>\n</html>\n";

function makeDependencies(dependencies) {
  let result = '';
  if (Array.isArray(dependencies)) {
    for (const dependency of dependencies) {
      const type = dependency.type;
      if (type === 'script') {
        result += `<script type="text/javascript" src="${dependency.url}"></script>`;
      } else if (type === 'style') {
        result += `<script type="text/javascript">
						(() => {
							const link = document.createElement('link');
							link.rel = 'stylesheet';
							link.href = "${dependency.url}";
							document.body.appendChild(link);
						})()
					</script>`;
      } else {
        console.log(`Unknown dependency type ${type}`);
      }
    }
  }

  return result;
}

function scriptify(script) {
  return `<script type="text/javascript">${script}</script>`;
}

var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    makeDependencies: makeDependencies,
    scriptify: scriptify
});

/* src/Output/Viewer.svelte generated by Svelte v3.29.0 */
const file = "src/Output/Viewer.svelte";

function add_css() {
	var style = element("style");
	style.id = "svelte-1bwdt9k-style";
	style.textContent = ".beyondnft__sandbox.svelte-1bwdt9k{background-color:white;border:none;width:100%;height:100%;position:relative}iframe.svelte-1bwdt9k{width:100%;height:100%;border:none;display:block}.greyed-out.svelte-1bwdt9k{filter:grayscale(50%) blur(1px);opacity:0.25}.beyondnft__sandbox__error.svelte-1bwdt9k{font-size:0.9em;position:absolute;top:0;left:0;padding:5px}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmlld2VyLnN2ZWx0ZSIsInNvdXJjZXMiOlsiVmlld2VyLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0PlxuICBpbXBvcnQgeyBjcmVhdGVFdmVudERpc3BhdGNoZXIsIG9uTW91bnQgfSBmcm9tICdzdmVsdGUnO1xuXG4gIGltcG9ydCBQcm94eSBmcm9tICcuL1Byb3h5JztcbiAgaW1wb3J0IHNyY2RvYyBmcm9tICcuL3NyY2RvYy9pbmRleC5qcyc7XG4gIGltcG9ydCAqIGFzIHV0aWxzIGZyb20gJy4vdXRpbHMuanMnO1xuXG4gIGV4cG9ydCBsZXQgY29kZSA9ICcnO1xuICBleHBvcnQgbGV0IHByb3h5O1xuICBleHBvcnQgbGV0IGpzb247XG4gIGV4cG9ydCBsZXQgb3duZXJfcHJvcGVydGllcztcbiAgZXhwb3J0IGxldCBvd25lcjtcbiAgZXhwb3J0IGxldCBzYW5kYm94X3Byb3BzID0gJyc7XG5cbiAgY29uc3QgZGlzcGF0Y2ggPSBjcmVhdGVFdmVudERpc3BhdGNoZXIoKTtcblxuICBsZXQgaWZyYW1lO1xuXG4gIGxldCBwZW5kaW5nX2ltcG9ydHMgPSAwO1xuICBsZXQgcGVuZGluZyA9IGZhbHNlO1xuICBsZXQgZXJyb3I7XG5cbiAgbGV0IGxvZ3MgPSBbXTtcbiAgbGV0IGxvZ19ncm91cF9zdGFjayA9IFtdO1xuICBsZXQgY3VycmVudF9sb2dfZ3JvdXAgPSBsb2dzO1xuICBsZXQgbGFzdF9jb25zb2xlX2V2ZW50O1xuXG4gIG9uTW91bnQoKCkgPT4ge1xuICAgIHByb3h5ID0gbmV3IFByb3h5KGlmcmFtZSwge1xuICAgICAgb25fZmV0Y2hfcHJvZ3Jlc3M6IChwcm9ncmVzcykgPT4ge1xuICAgICAgICBwZW5kaW5nX2ltcG9ydHMgPSBwcm9ncmVzcztcbiAgICAgIH0sXG4gICAgICBvbl9lcnJvcjogKGV2ZW50KSA9PiB7XG4gICAgICAgIHB1c2hfbG9ncyh7IGxldmVsOiAnZXJyb3InLCBhcmdzOiBbZXZlbnQudmFsdWVdIH0pO1xuICAgICAgICBzaG93X2Vycm9yKGV2ZW50LnZhbHVlKTtcbiAgICAgIH0sXG4gICAgICBvbl91bmhhbmRsZWRfcmVqZWN0aW9uOiAoZXZlbnQpID0+IHtcbiAgICAgICAgbGV0IGVycm9yID0gZXZlbnQudmFsdWU7XG4gICAgICAgIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSBlcnJvciA9IHsgbWVzc2FnZTogZXJyb3IgfTtcbiAgICAgICAgZXJyb3IubWVzc2FnZSA9ICdVbmNhdWdodCAoaW4gcHJvbWlzZSk6ICcgKyBlcnJvci5tZXNzYWdlO1xuICAgICAgICBwdXNoX2xvZ3MoeyBsZXZlbDogJ2Vycm9yJywgYXJnczogW2Vycm9yXSB9KTtcbiAgICAgICAgc2hvd19lcnJvcihlcnJvcik7XG4gICAgICB9LFxuICAgICAgb25fY29uc29sZTogKGxvZykgPT4ge1xuICAgICAgICBpZiAobG9nLmxldmVsID09PSAnY2xlYXInKSB7XG4gICAgICAgICAgY2xlYXJfbG9ncygpO1xuICAgICAgICAgIHB1c2hfbG9ncyhsb2cpO1xuICAgICAgICB9IGVsc2UgaWYgKGxvZy5kdXBsaWNhdGUpIHtcbiAgICAgICAgICBpbmNyZW1lbnRfZHVwbGljYXRlX2xvZygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHB1c2hfbG9ncyhsb2cpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgb25fY29uc29sZV9ncm91cDogKGFjdGlvbikgPT4ge1xuICAgICAgICBncm91cF9sb2dzKGFjdGlvbi5sYWJlbCwgZmFsc2UpO1xuICAgICAgfSxcbiAgICAgIG9uX2NvbnNvbGVfZ3JvdXBfZW5kOiAoKSA9PiB7XG4gICAgICAgIHVuZ3JvdXBfbG9ncygpO1xuICAgICAgfSxcbiAgICAgIG9uX2NvbnNvbGVfZ3JvdXBfY29sbGFwc2VkOiAoYWN0aW9uKSA9PiB7XG4gICAgICAgIGdyb3VwX2xvZ3MoYWN0aW9uLmxhYmVsLCB0cnVlKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZnJhbWUuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICAgIHByb3h5LmhhbmRsZV9saW5rcygpO1xuICAgICAgIWVycm9yICYmIGRpc3BhdGNoKCdsb2FkZWQnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBwcm94eS5kZXN0cm95KCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gbWFrZURlcGVuZGVuY2llcygpIHtcbiAgICBpZiAoIWpzb24uaW50ZXJhY3RpdmVfbmZ0KSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHJldHVybiB1dGlscy5tYWtlRGVwZW5kZW5jaWVzKGpzb24uaW50ZXJhY3RpdmVfbmZ0LmRlcGVuZGVuY2llcyk7XG4gIH1cblxuICBmdW5jdGlvbiBsb2FkUHJvcHMoKSB7XG4gICAgY29uc3QgcHJvcHMgPSB7fTtcbiAgICBpZiAoanNvbi5pbnRlcmFjdGl2ZV9uZnQpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGpzb24uaW50ZXJhY3RpdmVfbmZ0LnByb3BlcnRpZXMpKSB7XG4gICAgICAgIGxldCBvdmVycmlkZXIgPSB7fTtcbiAgICAgICAgaWYgKG93bmVyX3Byb3BlcnRpZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBvd25lcl9wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgb3ZlcnJpZGVyID0gb3duZXJfcHJvcGVydGllcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5vIE9iamVjdC5hc3NpZ24gYmVjYXVzZSB3ZSBvbmx5IHdhbnQgZGVjbGFyZWQgcHJvcHMgdG8gYmUgc2V0XG4gICAgICAgIGZvciAoY29uc3QgcHJvcCBvZiBqc29uLmludGVyYWN0aXZlX25mdC5wcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgcHJvcHNbcHJvcC5uYW1lXSA9IHByb3AudmFsdWU7XG4gICAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gb3ZlcnJpZGVyW3Byb3AubmFtZV0pIHtcbiAgICAgICAgICAgIHByb3BzW3Byb3AubmFtZV0gPSBvdmVycmlkZXJbcHJvcC5uYW1lXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcHJvcHM7XG4gIH1cblxuICBmdW5jdGlvbiByZXBsYWNlQ29kZShzcmNkb2MpIHtcbiAgICBsZXQgY29udGVudCA9IG1ha2VEZXBlbmRlbmNpZXMoKTtcblxuICAgIGNvbnN0IHByb3BzID0gbG9hZFByb3BzKCk7XG5cbiAgICBjb25zdCBpbmplY3RlZFByb3BzID0gYFxuICAgICAgd2luZG93LmNvbnRleHQucHJvcGVydGllcyA9IEpTT04ucGFyc2UoJyR7SlNPTi5zdHJpbmdpZnkocHJvcHMpfScpO1xuICAgIGA7XG5cbiAgICBjb25zdCBpbmplY3RlZEpTT04gPSBgXG4gICAgICB3aW5kb3cuY29udGV4dC5uZnRfanNvbiA9IEpTT04ucGFyc2UoJHtKU09OLnN0cmluZ2lmeShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoanNvbilcbiAgICAgICl9KTtcbiAgICBgO1xuXG4gICAgY29uc3QgaW5qZWN0ZWRPd25lciA9IGB3aW5kb3cuY29udGV4dC5vd25lciA9ICR7SlNPTi5zdHJpbmdpZnkob3duZXIpfTtgO1xuXG4gICAgY29udGVudCArPSB1dGlscy5zY3JpcHRpZnkoYFxuICAgICAgLy8gc3BlY2lmaWMgcDUgYmVjYXVzZSBpdCdzIGNhdXNpbmcgdHJvdWJsZXMuXG4gICAgICBpZiAodHlwZW9mIHA1ICE9PSAndW5kZWZpbmVkJyAmJiBwNS5kaXNhYmxlRnJpZW5kbHlFcnJvcnMpIHtcbiAgICAgICAgcDUuZGlzYWJsZUZyaWVuZGx5RXJyb3JzID0gdHJ1ZTtcbiAgICAgICAgbmV3IHA1KCk7XG4gICAgICB9XG5cbiAgICAgICR7aW5qZWN0ZWRQcm9wc31cbiAgICAgICR7aW5qZWN0ZWRKU09OfVxuICAgICAgJHtpbmplY3RlZE93bmVyfVxuICAgIGApO1xuXG4gICAgY29udGVudCArPSBjb2RlO1xuXG4gICAgcmV0dXJuIHNyY2RvYy5yZXBsYWNlKCc8IS0tIE5GVENPREUgLS0+JywgY29udGVudCk7XG4gIH1cblxuICBmdW5jdGlvbiBzaG93X2Vycm9yKGUpIHtcbiAgICBlcnJvciA9IGU7XG4gICAgZGlzcGF0Y2goJ2Vycm9yJywgZSk7XG4gIH1cblxuICBmdW5jdGlvbiBwdXNoX2xvZ3MobG9nKSB7XG4gICAgY3VycmVudF9sb2dfZ3JvdXAucHVzaCgobGFzdF9jb25zb2xlX2V2ZW50ID0gbG9nKSk7XG4gICAgbG9ncyA9IGxvZ3M7XG4gIH1cblxuICBmdW5jdGlvbiBncm91cF9sb2dzKGxhYmVsLCBjb2xsYXBzZWQpIHtcbiAgICBjb25zdCBncm91cF9sb2cgPSB7IGxldmVsOiAnZ3JvdXAnLCBsYWJlbCwgY29sbGFwc2VkLCBsb2dzOiBbXSB9O1xuICAgIGN1cnJlbnRfbG9nX2dyb3VwLnB1c2goZ3JvdXBfbG9nKTtcbiAgICBsb2dfZ3JvdXBfc3RhY2sucHVzaChjdXJyZW50X2xvZ19ncm91cCk7XG4gICAgY3VycmVudF9sb2dfZ3JvdXAgPSBncm91cF9sb2cubG9ncztcbiAgICBsb2dzID0gbG9ncztcbiAgfVxuXG4gIGZ1bmN0aW9uIHVuZ3JvdXBfbG9ncygpIHtcbiAgICBjdXJyZW50X2xvZ19ncm91cCA9IGxvZ19ncm91cF9zdGFjay5wb3AoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGluY3JlbWVudF9kdXBsaWNhdGVfbG9nKCkge1xuICAgIGNvbnN0IGxhc3RfbG9nID0gY3VycmVudF9sb2dfZ3JvdXBbY3VycmVudF9sb2dfZ3JvdXAubGVuZ3RoIC0gMV07XG5cbiAgICBpZiAobGFzdF9sb2cpIHtcbiAgICAgIGxhc3RfbG9nLmNvdW50ID0gKGxhc3RfbG9nLmNvdW50IHx8IDEpICsgMTtcbiAgICAgIGxvZ3MgPSBsb2dzO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0X2NvbnNvbGVfZXZlbnQuY291bnQgPSAxO1xuICAgICAgcHVzaF9sb2dzKGxhc3RfY29uc29sZV9ldmVudCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2xlYXJfbG9ncygpIHtcbiAgICBjdXJyZW50X2xvZ19ncm91cCA9IGxvZ3MgPSBbXTtcbiAgfVxuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cbiAgLmJleW9uZG5mdF9fc2FuZGJveCB7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogd2hpdGU7XG4gICAgYm9yZGVyOiBub25lO1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGhlaWdodDogMTAwJTtcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIH1cblxuICBpZnJhbWUge1xuICAgIHdpZHRoOiAxMDAlO1xuICAgIGhlaWdodDogMTAwJTtcbiAgICBib3JkZXI6IG5vbmU7XG4gICAgZGlzcGxheTogYmxvY2s7XG4gIH1cblxuICAuZ3JleWVkLW91dCB7XG4gICAgZmlsdGVyOiBncmF5c2NhbGUoNTAlKSBibHVyKDFweCk7XG4gICAgb3BhY2l0eTogMC4yNTtcbiAgfVxuXG4gIC5iZXlvbmRuZnRfX3NhbmRib3hfX2Vycm9yIHtcbiAgICBmb250LXNpemU6IDAuOWVtO1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICB0b3A6IDA7XG4gICAgbGVmdDogMDtcbiAgICBwYWRkaW5nOiA1cHg7XG4gIH1cbjwvc3R5bGU+XG5cbjxkaXYgY2xhc3M9XCJiZXlvbmRuZnRfX3NhbmRib3hcIj5cbiAgPGlmcmFtZVxuICAgIHRpdGxlPVwiU2FuZGJveFwiXG4gICAgYmluZDp0aGlzPXtpZnJhbWV9XG4gICAgc2FuZGJveD17YGFsbG93LXNjcmlwdHMgYWxsb3ctcG9pbnRlci1sb2NrIGFsbG93LXBvcHVwcyAke3NhbmRib3hfcHJvcHN9YH1cbiAgICBjbGFzczpncmV5ZWQtb3V0PXtlcnJvciB8fCBwZW5kaW5nIHx8IHBlbmRpbmdfaW1wb3J0c31cbiAgICBzcmNkb2M9e3JlcGxhY2VDb2RlKHNyY2RvYyl9IC8+XG4gIHsjaWYgZXJyb3J9XG4gICAgPHN0cm9uZyBjbGFzcz1cImJleW9uZG5mdF9fc2FuZGJveF9fZXJyb3JcIj5cbiAgICAgIDxlbT5Tb3JyeSwgYW4gZXJyb3Igb2NjdXJlZCB3aGlsZSBleGVjdXRpbmcgdGhlIE5GVC48L2VtPlxuICAgIDwvc3Ryb25nPlxuICB7L2lmfVxuPC9kaXY+XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBaUxFLG1CQUFtQixlQUFDLENBQUMsQUFDbkIsZ0JBQWdCLENBQUUsS0FBSyxDQUN2QixNQUFNLENBQUUsSUFBSSxDQUNaLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixRQUFRLENBQUUsUUFBUSxBQUNwQixDQUFDLEFBRUQsTUFBTSxlQUFDLENBQUMsQUFDTixLQUFLLENBQUUsSUFBSSxDQUNYLE1BQU0sQ0FBRSxJQUFJLENBQ1osTUFBTSxDQUFFLElBQUksQ0FDWixPQUFPLENBQUUsS0FBSyxBQUNoQixDQUFDLEFBRUQsV0FBVyxlQUFDLENBQUMsQUFDWCxNQUFNLENBQUUsVUFBVSxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUNoQyxPQUFPLENBQUUsSUFBSSxBQUNmLENBQUMsQUFFRCwwQkFBMEIsZUFBQyxDQUFDLEFBQzFCLFNBQVMsQ0FBRSxLQUFLLENBQ2hCLFFBQVEsQ0FBRSxRQUFRLENBQ2xCLEdBQUcsQ0FBRSxDQUFDLENBQ04sSUFBSSxDQUFFLENBQUMsQ0FDUCxPQUFPLENBQUUsR0FBRyxBQUNkLENBQUMifQ== */";
	append_dev(document.head, style);
}

// (214:2) {#if error}
function create_if_block(ctx) {
	let strong;
	let em;

	const block = {
		c: function create() {
			strong = element("strong");
			em = element("em");
			em.textContent = "Sorry, an error occured while executing the NFT.";
			add_location(em, file, 215, 6, 5076);
			attr_dev(strong, "class", "beyondnft__sandbox__error svelte-1bwdt9k");
			add_location(strong, file, 214, 4, 5027);
		},
		m: function mount(target, anchor) {
			insert_dev(target, strong, anchor);
			append_dev(strong, em);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(strong);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(214:2) {#if error}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let div;
	let iframe_1;
	let iframe_1_sandbox_value;
	let iframe_1_srcdoc_value;
	let t;
	let if_block = /*error*/ ctx[3] && create_if_block(ctx);

	const block = {
		c: function create() {
			div = element("div");
			iframe_1 = element("iframe");
			t = space();
			if (if_block) if_block.c();
			attr_dev(iframe_1, "title", "Sandbox");
			attr_dev(iframe_1, "sandbox", iframe_1_sandbox_value = `allow-scripts allow-pointer-lock allow-popups ${/*sandbox_props*/ ctx[0]}`);
			attr_dev(iframe_1, "srcdoc", iframe_1_srcdoc_value = /*replaceCode*/ ctx[5](srcdoc));
			attr_dev(iframe_1, "class", "svelte-1bwdt9k");
			toggle_class(iframe_1, "greyed-out", /*error*/ ctx[3] || /*pending*/ ctx[4] || /*pending_imports*/ ctx[2]);
			add_location(iframe_1, file, 207, 2, 4784);
			attr_dev(div, "class", "beyondnft__sandbox svelte-1bwdt9k");
			add_location(div, file, 206, 0, 4749);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, iframe_1);
			/*iframe_1_binding*/ ctx[11](iframe_1);
			append_dev(div, t);
			if (if_block) if_block.m(div, null);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*sandbox_props*/ 1 && iframe_1_sandbox_value !== (iframe_1_sandbox_value = `allow-scripts allow-pointer-lock allow-popups ${/*sandbox_props*/ ctx[0]}`)) {
				attr_dev(iframe_1, "sandbox", iframe_1_sandbox_value);
			}

			if (dirty & /*error, pending, pending_imports*/ 28) {
				toggle_class(iframe_1, "greyed-out", /*error*/ ctx[3] || /*pending*/ ctx[4] || /*pending_imports*/ ctx[2]);
			}

			if (/*error*/ ctx[3]) {
				if (if_block) ; else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			/*iframe_1_binding*/ ctx[11](null);
			if (if_block) if_block.d();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Viewer", slots, []);
	let { code = "" } = $$props;
	let { proxy } = $$props;
	let { json } = $$props;
	let { owner_properties } = $$props;
	let { owner } = $$props;
	let { sandbox_props = "" } = $$props;
	const dispatch = createEventDispatcher();
	let iframe;
	let pending_imports = 0;
	let pending = false;
	let error;
	let logs = [];
	let log_group_stack = [];
	let current_log_group = logs;
	let last_console_event;

	onMount(() => {
		$$invalidate(6, proxy = new Proxy(iframe,
		{
				on_fetch_progress: progress => {
					$$invalidate(2, pending_imports = progress);
				},
				on_error: event => {
					push_logs({ level: "error", args: [event.value] });
					show_error(event.value);
				},
				on_unhandled_rejection: event => {
					let error = event.value;
					if (typeof error === "string") error = { message: error };
					error.message = "Uncaught (in promise): " + error.message;
					push_logs({ level: "error", args: [error] });
					show_error(error);
				},
				on_console: log => {
					if (log.level === "clear") {
						clear_logs();
						push_logs(log);
					} else if (log.duplicate) {
						increment_duplicate_log();
					} else {
						push_logs(log);
					}
				},
				on_console_group: action => {
					group_logs(action.label, false);
				},
				on_console_group_end: () => {
					ungroup_logs();
				},
				on_console_group_collapsed: action => {
					group_logs(action.label, true);
				}
			}));

		iframe.addEventListener("load", () => {
			proxy.handle_links();
			!error && dispatch("loaded");
		});

		return () => {
			proxy.destroy();
		};
	});

	function makeDependencies$1() {
		if (!json.interactive_nft) {
			return "";
		}

		return makeDependencies(json.interactive_nft.dependencies);
	}

	function loadProps() {
		const props = {};

		if (json.interactive_nft) {
			if (Array.isArray(json.interactive_nft.properties)) {
				let overrider = {};

				if (owner_properties && "object" === typeof owner_properties) {
					overrider = owner_properties;
				}

				// no Object.assign because we only want declared props to be set
				for (const prop of json.interactive_nft.properties) {
					props[prop.name] = prop.value;

					if (undefined !== overrider[prop.name]) {
						props[prop.name] = overrider[prop.name];
					}
				}
			}
		}

		return props;
	}

	function replaceCode(srcdoc) {
		let content = makeDependencies$1();
		const props = loadProps();

		const injectedProps = `
      window.context.properties = JSON.parse('${JSON.stringify(props)}');
    `;

		const injectedJSON = `
      window.context.nft_json = JSON.parse(${JSON.stringify(JSON.stringify(json))});
    `;

		const injectedOwner = `window.context.owner = ${JSON.stringify(owner)};`;

		content += scriptify(`
      // specific p5 because it's causing troubles.
      if (typeof p5 !== 'undefined' && p5.disableFriendlyErrors) {
        p5.disableFriendlyErrors = true;
        new p5();
      }

      ${injectedProps}
      ${injectedJSON}
      ${injectedOwner}
    `);

		content += code;
		return srcdoc.replace("<!-- NFTCODE -->", content);
	}

	function show_error(e) {
		$$invalidate(3, error = e);
		dispatch("error", e);
	}

	function push_logs(log) {
		current_log_group.push(last_console_event = log);
		logs = logs;
	}

	function group_logs(label, collapsed) {
		const group_log = {
			level: "group",
			label,
			collapsed,
			logs: []
		};

		current_log_group.push(group_log);
		log_group_stack.push(current_log_group);
		current_log_group = group_log.logs;
		logs = logs;
	}

	function ungroup_logs() {
		current_log_group = log_group_stack.pop();
	}

	function increment_duplicate_log() {
		const last_log = current_log_group[current_log_group.length - 1];

		if (last_log) {
			last_log.count = (last_log.count || 1) + 1;
			logs = logs;
		} else {
			last_console_event.count = 1;
			push_logs(last_console_event);
		}
	}

	function clear_logs() {
		current_log_group = logs = [];
	}

	const writable_props = ["code", "proxy", "json", "owner_properties", "owner", "sandbox_props"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Viewer> was created with unknown prop '${key}'`);
	});

	function iframe_1_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			iframe = $$value;
			$$invalidate(1, iframe);
		});
	}

	$$self.$$set = $$props => {
		if ("code" in $$props) $$invalidate(7, code = $$props.code);
		if ("proxy" in $$props) $$invalidate(6, proxy = $$props.proxy);
		if ("json" in $$props) $$invalidate(8, json = $$props.json);
		if ("owner_properties" in $$props) $$invalidate(9, owner_properties = $$props.owner_properties);
		if ("owner" in $$props) $$invalidate(10, owner = $$props.owner);
		if ("sandbox_props" in $$props) $$invalidate(0, sandbox_props = $$props.sandbox_props);
	};

	$$self.$capture_state = () => ({
		createEventDispatcher,
		onMount,
		Proxy,
		srcdoc,
		utils,
		code,
		proxy,
		json,
		owner_properties,
		owner,
		sandbox_props,
		dispatch,
		iframe,
		pending_imports,
		pending,
		error,
		logs,
		log_group_stack,
		current_log_group,
		last_console_event,
		makeDependencies: makeDependencies$1,
		loadProps,
		replaceCode,
		show_error,
		push_logs,
		group_logs,
		ungroup_logs,
		increment_duplicate_log,
		clear_logs
	});

	$$self.$inject_state = $$props => {
		if ("code" in $$props) $$invalidate(7, code = $$props.code);
		if ("proxy" in $$props) $$invalidate(6, proxy = $$props.proxy);
		if ("json" in $$props) $$invalidate(8, json = $$props.json);
		if ("owner_properties" in $$props) $$invalidate(9, owner_properties = $$props.owner_properties);
		if ("owner" in $$props) $$invalidate(10, owner = $$props.owner);
		if ("sandbox_props" in $$props) $$invalidate(0, sandbox_props = $$props.sandbox_props);
		if ("iframe" in $$props) $$invalidate(1, iframe = $$props.iframe);
		if ("pending_imports" in $$props) $$invalidate(2, pending_imports = $$props.pending_imports);
		if ("pending" in $$props) $$invalidate(4, pending = $$props.pending);
		if ("error" in $$props) $$invalidate(3, error = $$props.error);
		if ("logs" in $$props) logs = $$props.logs;
		if ("log_group_stack" in $$props) log_group_stack = $$props.log_group_stack;
		if ("current_log_group" in $$props) current_log_group = $$props.current_log_group;
		if ("last_console_event" in $$props) last_console_event = $$props.last_console_event;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		sandbox_props,
		iframe,
		pending_imports,
		error,
		pending,
		replaceCode,
		proxy,
		code,
		json,
		owner_properties,
		owner,
		iframe_1_binding
	];
}

class Viewer extends SvelteComponentDev {
	constructor(options) {
		super(options);
		if (!document.getElementById("svelte-1bwdt9k-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			code: 7,
			proxy: 6,
			json: 8,
			owner_properties: 9,
			owner: 10,
			sandbox_props: 0
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Viewer",
			options,
			id: create_fragment.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*proxy*/ ctx[6] === undefined && !("proxy" in props)) {
			console.warn("<Viewer> was created without expected prop 'proxy'");
		}

		if (/*json*/ ctx[8] === undefined && !("json" in props)) {
			console.warn("<Viewer> was created without expected prop 'json'");
		}

		if (/*owner_properties*/ ctx[9] === undefined && !("owner_properties" in props)) {
			console.warn("<Viewer> was created without expected prop 'owner_properties'");
		}

		if (/*owner*/ ctx[10] === undefined && !("owner" in props)) {
			console.warn("<Viewer> was created without expected prop 'owner'");
		}
	}

	get code() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set code(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get proxy() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set proxy(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get json() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set json(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get owner_properties() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set owner_properties(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get owner() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set owner(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get sandbox_props() {
		throw new Error("<Viewer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set sandbox_props(value) {
		throw new Error("<Viewer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/Sandbox.svelte generated by Svelte v3.29.0 */

const { Error: Error_1 } = globals;

// (101:0) {:else}
function create_else_block(ctx) {
	let t;

	const block = {
		c: function create() {
			t = text("Loading...");
		},
		m: function mount(target, anchor) {
			insert_dev(target, t, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(t);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(101:0) {:else}",
		ctx
	});

	return block;
}

// (90:0) {#if code}
function create_if_block$1(ctx) {
	let viewer;
	let updating_proxy;
	let current;

	function viewer_proxy_binding(value) {
		/*viewer_proxy_binding*/ ctx[7].call(null, value);
	}

	let viewer_props = {
		code: /*code*/ ctx[1],
		owner_properties: /*owner_properties*/ ctx[2],
		sandbox_props: /*sandbox_props*/ ctx[4],
		owner: /*owner*/ ctx[3],
		json: /*data*/ ctx[0]
	};

	if (/*proxy*/ ctx[5] !== void 0) {
		viewer_props.proxy = /*proxy*/ ctx[5];
	}

	viewer = new Viewer({ props: viewer_props, $$inline: true });
	binding_callbacks.push(() => bind(viewer, "proxy", viewer_proxy_binding));
	viewer.$on("loaded", /*loaded_handler*/ ctx[8]);
	viewer.$on("error", /*error_handler*/ ctx[9]);
	viewer.$on("warning", /*warning_handler*/ ctx[10]);

	const block = {
		c: function create() {
			create_component(viewer.$$.fragment);
		},
		m: function mount(target, anchor) {
			mount_component(viewer, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const viewer_changes = {};
			if (dirty & /*code*/ 2) viewer_changes.code = /*code*/ ctx[1];
			if (dirty & /*owner_properties*/ 4) viewer_changes.owner_properties = /*owner_properties*/ ctx[2];
			if (dirty & /*sandbox_props*/ 16) viewer_changes.sandbox_props = /*sandbox_props*/ ctx[4];
			if (dirty & /*owner*/ 8) viewer_changes.owner = /*owner*/ ctx[3];
			if (dirty & /*data*/ 1) viewer_changes.json = /*data*/ ctx[0];

			if (!updating_proxy && dirty & /*proxy*/ 32) {
				updating_proxy = true;
				viewer_changes.proxy = /*proxy*/ ctx[5];
				add_flush_callback(() => updating_proxy = false);
			}

			viewer.$set(viewer_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(viewer.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(viewer.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(viewer, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(90:0) {#if code}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*code*/ ctx[1]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Sandbox", slots, []);
	const dispatch = createEventDispatcher();
	let { data = {} } = $$props;
	let { code = "" } = $$props;
	let { owner_properties = {} } = $$props;
	let { owner = "0x0000000000000000000000000000000000000000" } = $$props;
	let { sandbox_props = "" } = $$props;
	let proxy = null;

	function getProxy() {
		return proxy;
	}

	onMount(async () => {
		if ("string" === typeof data) {
			await fetch(data).then(res => res.json()).then(_data => $$invalidate(0, data = _data)).catch(e => {
				dispatch("warning", new Error(`Error while fetching NFT's JSON at ${data}`));
				$$invalidate(0, data = null);
			});
		}

		if (!data) {
			dispatch("error", new Error(`You need to provide a data property.
      Either a valid uri to the NFT JSON or the parsed NFT JSON.`));

			return;
		}

		// first fetch owner_properties if it's an URI
		if (owner_properties) {
			if ("string" === typeof owner_properties) {
				await fetch(owner_properties).then(res => res.json()).then(_owner_properties => $$invalidate(2, owner_properties = _owner_properties)).catch(e => {
					dispatch("warning", `Error while fetching owner_properties on ${owner_properties}.
            Setting owner_properties to default.`);

					$$invalidate(2, owner_properties = {});
				});
			}
		}

		// get code from interactive_nft
		if (!code && data.interactive_nft) {
			if (data.interactive_nft.code) {
				$$invalidate(1, code = data.interactive_nft.code);

				// if the code is in the interactive_nft property (not recommended)
				// we delete it because it might be a problem when we pass this object to the iframe
				// because we have to stringify it
				$$invalidate(0, data.interactive_nft.code = null, data);
			} else if (data.interactive_nft.code_uri) {
				await fetch(data.interactive_nft.code_uri).then(res => res.text()).then(_code => $$invalidate(1, code = _code)).catch(e => {
					dispatch("Error", new Error(`Error while fetching ${data.interactive_nft.code_uri}`));
				});
			}
		}

		if (!code) {
			dispatch("Error", new Error("You need to provide code for this NFT to run"));
		}
	});

	const writable_props = ["data", "code", "owner_properties", "owner", "sandbox_props"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sandbox> was created with unknown prop '${key}'`);
	});

	function viewer_proxy_binding(value) {
		proxy = value;
		$$invalidate(5, proxy);
	}

	function loaded_handler(event) {
		bubble($$self, event);
	}

	function error_handler(event) {
		bubble($$self, event);
	}

	function warning_handler(event) {
		bubble($$self, event);
	}

	$$self.$$set = $$props => {
		if ("data" in $$props) $$invalidate(0, data = $$props.data);
		if ("code" in $$props) $$invalidate(1, code = $$props.code);
		if ("owner_properties" in $$props) $$invalidate(2, owner_properties = $$props.owner_properties);
		if ("owner" in $$props) $$invalidate(3, owner = $$props.owner);
		if ("sandbox_props" in $$props) $$invalidate(4, sandbox_props = $$props.sandbox_props);
	};

	$$self.$capture_state = () => ({
		createEventDispatcher,
		onMount,
		Viewer,
		dispatch,
		data,
		code,
		owner_properties,
		owner,
		sandbox_props,
		proxy,
		getProxy
	});

	$$self.$inject_state = $$props => {
		if ("data" in $$props) $$invalidate(0, data = $$props.data);
		if ("code" in $$props) $$invalidate(1, code = $$props.code);
		if ("owner_properties" in $$props) $$invalidate(2, owner_properties = $$props.owner_properties);
		if ("owner" in $$props) $$invalidate(3, owner = $$props.owner);
		if ("sandbox_props" in $$props) $$invalidate(4, sandbox_props = $$props.sandbox_props);
		if ("proxy" in $$props) $$invalidate(5, proxy = $$props.proxy);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		data,
		code,
		owner_properties,
		owner,
		sandbox_props,
		proxy,
		getProxy,
		viewer_proxy_binding,
		loaded_handler,
		error_handler,
		warning_handler
	];
}

class Sandbox extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			data: 0,
			code: 1,
			owner_properties: 2,
			owner: 3,
			sandbox_props: 4,
			getProxy: 6
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Sandbox",
			options,
			id: create_fragment$1.name
		});
	}

	get data() {
		throw new Error_1("<Sandbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set data(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get code() {
		throw new Error_1("<Sandbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set code(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get owner_properties() {
		throw new Error_1("<Sandbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set owner_properties(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get owner() {
		throw new Error_1("<Sandbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set owner(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get sandbox_props() {
		throw new Error_1("<Sandbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set sandbox_props(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get getProxy() {
		return this.$$.ctx[6];
	}

	set getProxy(value) {
		throw new Error_1("<Sandbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

export default Sandbox;
