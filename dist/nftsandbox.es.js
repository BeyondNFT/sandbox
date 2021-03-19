function noop() { }
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
        throw new Error('Function called outside component initialization');
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

  size() {
    return this.iframe_command('size');
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

var srcdoc = "<!DOCTYPE html>\n<html>\n  <head>\n    <style>\n      \n    </style>\n\n    <script>\n      (function () {\n        const local_eval = eval;\n        eval = function () {};\n\n        function handle_message(ev) {\n          let { action, cmd_id } = ev.data;\n          const send_message = (payload) =>\n            parent.postMessage({ ...payload }, ev.origin);\n\n          const send_reply = (payload) => send_message({ ...payload, cmd_id });\n          const send_ok = (args) => send_reply({ action: 'cmd_ok', args });\n          const send_error = (message, stack) =>\n            send_reply({ action: 'cmd_error', message, stack });\n\n          if (action === 'size') {\n            send_ok({\n              width: document.body.offsetWidth,\n              height: document.body.offsetHeight,\n            });\n          }\n\n          if (action === 'eval') {\n            try {\n              const { script } = ev.data.args;\n              local_eval(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script') {\n            try {\n              const script = document.createElement('script');\n              script.src = ev.data.args;\n              script.onload = () => send_ok();\n              document.body.appendChild(script);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_script_content') {\n            try {\n              const script = document.createElement('script');\n              script.text = ev.data.args;\n              script.type = 'text/javascript';\n              document.body.appendChild(script);\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'add_style') {\n            try {\n              const link = document.createElement('link');\n              link.rel = 'stylesheet';\n              link.href = ev.data.args;\n              link.onload = () => send_ok();\n              document.body.appendChild(link);\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n\n          if (action === 'catch_clicks') {\n            try {\n              const top_origin = ev.origin;\n              document.body.addEventListener('click', (event) => {\n                if (event.which !== 1) return;\n                if (event.metaKey || event.ctrlKey || event.shiftKey) return;\n                if (event.defaultPrevented) return;\n\n                // ensure target is a link\n                let el = event.target;\n                while (el && el.nodeName !== 'A') el = el.parentNode;\n                if (!el || el.nodeName !== 'A') return;\n\n                if (\n                  el.hasAttribute('download') ||\n                  el.getAttribute('rel') === 'external' ||\n                  el.target\n                )\n                  return;\n\n                event.preventDefault();\n\n                if (el.href.startsWith(top_origin)) {\n                  const url = new URL(el.href);\n                  if (url.hash[0] === '#') {\n                    window.location.hash = url.hash;\n                    return;\n                  }\n                }\n\n                window.open(el.href, '_blank');\n              });\n              send_ok();\n            } catch (e) {\n              send_error(e.message, e.stack);\n            }\n          }\n        }\n\n        window.addEventListener('message', handle_message, false);\n\n        window.onerror = function (msg, url, lineNo, columnNo, error) {\n          try {\n            parent.postMessage({ action: 'error', value: error }, '*');\n          } catch (e) {\n            parent.postMessage({ action: 'error', value: msg }, '*');\n            parent.postMessage({ action: 'error', value: error }, '*');\n          }\n        };\n\n        window.addEventListener('unhandledrejection', (event) => {\n          parent.postMessage(\n            { action: 'unhandledrejection', value: event.reason },\n            '*'\n          );\n        });\n\n        let previous = { level: null, args: null };\n\n        ['clear', 'log', 'info', 'dir', 'warn', 'error', 'table'].forEach(\n          (level) => {\n            const original = console[level];\n            console[level] = (...args) => {\n              const stringifiedArgs = stringify(args);\n              if (\n                previous.level === level &&\n                previous.args &&\n                previous.args === stringifiedArgs\n              ) {\n                parent.postMessage(\n                  { action: 'console', level, duplicate: true },\n                  '*'\n                );\n              } else {\n                previous = { level, args: stringifiedArgs };\n\n                try {\n                  parent.postMessage({ action: 'console', level, args }, '*');\n                } catch (err) {\n                  parent.postMessage(\n                    { action: 'console', level: 'unclonable' },\n                    '*'\n                  );\n                }\n              }\n\n              original(...args);\n            };\n          }\n        );\n\n        [\n          { method: 'group', action: 'console_group' },\n          { method: 'groupEnd', action: 'console_group_end' },\n          { method: 'groupCollapsed', action: 'console_group_collapsed' },\n        ].forEach((group_action) => {\n          const original = console[group_action.method];\n          console[group_action.method] = (label) => {\n            parent.postMessage({ action: group_action.action, label }, '*');\n\n            original(label);\n          };\n        });\n\n        const timers = new Map();\n        const original_time = console.time;\n        const original_timelog = console.timeLog;\n        const original_timeend = console.timeEnd;\n\n        console.time = (label = 'default') => {\n          original_time(label);\n          timers.set(label, performance.now());\n        };\n        console.timeLog = (label = 'default') => {\n          original_timelog(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n        };\n        console.timeEnd = (label = 'default') => {\n          original_timeend(label);\n          const now = performance.now();\n          if (timers.has(label)) {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-log',\n                args: [`${label}: ${now - timers.get(label)}ms`],\n              },\n              '*'\n            );\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: [`Timer '${label}' does not exist`],\n              },\n              '*'\n            );\n          }\n          timers.delete(label);\n        };\n\n        const original_assert = console.assert;\n        console.assert = (condition, ...args) => {\n          if (condition) {\n            const stack = new Error().stack;\n            parent.postMessage(\n              { action: 'console', level: 'assert', args, stack },\n              '*'\n            );\n          }\n          original_assert(condition, ...args);\n        };\n\n        const counter = new Map();\n        const original_count = console.count;\n        const original_countreset = console.countReset;\n\n        console.count = (label = 'default') => {\n          counter.set(label, (counter.get(label) || 0) + 1);\n          parent.postMessage(\n            {\n              action: 'console',\n              level: 'system-log',\n              args: `${label}: ${counter.get(label)}`,\n            },\n            '*'\n          );\n          original_count(label);\n        };\n\n        console.countReset = (label = 'default') => {\n          if (counter.has(label)) {\n            counter.set(label, 0);\n          } else {\n            parent.postMessage(\n              {\n                action: 'console',\n                level: 'system-warn',\n                args: `Count for '${label}' does not exist`,\n              },\n              '*'\n            );\n          }\n          original_countreset(label);\n        };\n\n        const original_trace = console.trace;\n\n        console.trace = (...args) => {\n          const stack = new Error().stack;\n          parent.postMessage(\n            { action: 'console', level: 'trace', args, stack },\n            '*'\n          );\n          original_trace(...args);\n        };\n\n        function stringify(args) {\n          try {\n            return JSON.stringify(args);\n          } catch (error) {\n            return null;\n          }\n        }\n      })(this);\n\n      // remove alert, set window context\n      (() => {\n        const original_alert = window.alert;\n        window.alert = function () {};\n\n        window.context = {\n          nft_json: {},\n          config: {},\n          owner: '0x0000000000000000000000000000000000000000',\n        };\n      })(this);\n    </script>\n    <style>\n      body,\n      html {\n        padding: 0;\n        margin: 0;\n        min-width: 100%;\n        min-height: 100%;\n      }\n\n      body {\n        position: absolute;\n        top: 0;\n        left: 0;\n      }\n    </style>\n  </head>\n  <body>\n    <!-- NFTCODE -->\n  </body>\n</html>\n";

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

/* src/Output/Viewer.svelte generated by Svelte v3.29.4 */

function add_css() {
	var style = element("style");
	style.id = "svelte-uaiew6-style";
	style.textContent = ".beyondnft__sandbox.svelte-uaiew6{background-color:white;border:none;width:100%;height:100%;position:relative}iframe.svelte-uaiew6{min-width:100%;min-height:100%;border:none;display:block}.greyed-out.svelte-uaiew6{filter:grayscale(50%) blur(1px);opacity:0.25}.beyondnft__sandbox__error.svelte-uaiew6{font-size:0.9em;position:absolute;top:0;left:0;padding:5px}";
	append(document.head, style);
}

// (185:2) {#if error}
function create_if_block(ctx) {
	let strong;

	return {
		c() {
			strong = element("strong");
			strong.innerHTML = `<em>Sorry, an error occured while executing the NFT.</em>`;
			attr(strong, "class", "beyondnft__sandbox__error svelte-uaiew6");
		},
		m(target, anchor) {
			insert(target, strong, anchor);
		},
		d(detaching) {
			if (detaching) detach(strong);
		}
	};
}

function create_fragment(ctx) {
	let div;
	let iframe_1;
	let iframe_1_sandbox_value;
	let iframe_1_srcdoc_value;
	let t;
	let if_block = /*error*/ ctx[3] && create_if_block();

	return {
		c() {
			div = element("div");
			iframe_1 = element("iframe");
			t = space();
			if (if_block) if_block.c();
			attr(iframe_1, "title", "Sandbox");
			attr(iframe_1, "sandbox", iframe_1_sandbox_value = `allow-scripts allow-pointer-lock allow-popups allow-downloads ${/*sandbox_props*/ ctx[0]}`);
			attr(iframe_1, "srcdoc", iframe_1_srcdoc_value = /*replaceCode*/ ctx[4](srcdoc));
			attr(iframe_1, "class", "svelte-uaiew6");
			toggle_class(iframe_1, "greyed-out", /*error*/ ctx[3] || pending || /*pending_imports*/ ctx[2]);
			attr(div, "class", "beyondnft__sandbox svelte-uaiew6");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, iframe_1);
			/*iframe_1_binding*/ ctx[10](iframe_1);
			append(div, t);
			if (if_block) if_block.m(div, null);
		},
		p(ctx, [dirty]) {
			if (dirty & /*sandbox_props*/ 1 && iframe_1_sandbox_value !== (iframe_1_sandbox_value = `allow-scripts allow-pointer-lock allow-popups allow-downloads ${/*sandbox_props*/ ctx[0]}`)) {
				attr(iframe_1, "sandbox", iframe_1_sandbox_value);
			}

			if (dirty & /*error, pending, pending_imports*/ 12) {
				toggle_class(iframe_1, "greyed-out", /*error*/ ctx[3] || pending || /*pending_imports*/ ctx[2]);
			}

			if (/*error*/ ctx[3]) {
				if (if_block) ; else {
					if_block = create_if_block();
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
		d(detaching) {
			if (detaching) detach(div);
			/*iframe_1_binding*/ ctx[10](null);
			if (if_block) if_block.d();
		}
	};
}

let pending = false;

function instance($$self, $$props, $$invalidate) {
	let { code = "" } = $$props;
	let { proxy } = $$props;
	let { json } = $$props;
	let { owner_properties } = $$props;
	let { owner } = $$props;
	let { sandbox_props = "" } = $$props;
	const dispatch = createEventDispatcher();
	let iframe;
	let pending_imports = 0;
	let error;
	let logs = [];
	let log_group_stack = [];
	let current_log_group = logs;
	let last_console_event;

	onMount(() => {
		$$invalidate(5, proxy = new Proxy(iframe,
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

	function iframe_1_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			iframe = $$value;
			$$invalidate(1, iframe);
		});
	}

	$$self.$$set = $$props => {
		if ("code" in $$props) $$invalidate(6, code = $$props.code);
		if ("proxy" in $$props) $$invalidate(5, proxy = $$props.proxy);
		if ("json" in $$props) $$invalidate(7, json = $$props.json);
		if ("owner_properties" in $$props) $$invalidate(8, owner_properties = $$props.owner_properties);
		if ("owner" in $$props) $$invalidate(9, owner = $$props.owner);
		if ("sandbox_props" in $$props) $$invalidate(0, sandbox_props = $$props.sandbox_props);
	};

	return [
		sandbox_props,
		iframe,
		pending_imports,
		error,
		replaceCode,
		proxy,
		code,
		json,
		owner_properties,
		owner,
		iframe_1_binding
	];
}

class Viewer extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-uaiew6-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			code: 6,
			proxy: 5,
			json: 7,
			owner_properties: 8,
			owner: 9,
			sandbox_props: 0
		});
	}
}

/* src/Sandbox.svelte generated by Svelte v3.29.4 */

function create_else_block(ctx) {
	let t;

	return {
		c() {
			t = text("Loading...");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (91:0) {#if code}
function create_if_block$1(ctx) {
	let viewer;
	let updating_proxy;
	let current;

	function viewer_proxy_binding(value) {
		/*viewer_proxy_binding*/ ctx[8].call(null, value);
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

	viewer = new Viewer({ props: viewer_props });
	binding_callbacks.push(() => bind(viewer, "proxy", viewer_proxy_binding));
	viewer.$on("loaded", /*loaded_handler*/ ctx[9]);
	viewer.$on("error", /*error_handler*/ ctx[10]);
	viewer.$on("warning", /*warning_handler*/ ctx[11]);

	return {
		c() {
			create_component(viewer.$$.fragment);
		},
		m(target, anchor) {
			mount_component(viewer, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
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
		i(local) {
			if (current) return;
			transition_in(viewer.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(viewer.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(viewer, detaching);
		}
	};
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

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
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
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	const dispatch = createEventDispatcher();
	let { data = {} } = $$props;
	let { code = "" } = $$props;
	let { owner_properties = {} } = $$props;
	let { owner = "0x0000000000000000000000000000000000000000" } = $$props;
	let { sandbox_props = "" } = $$props;
	const version = "0.0.7";
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

	return [
		data,
		code,
		owner_properties,
		owner,
		sandbox_props,
		proxy,
		version,
		getProxy,
		viewer_proxy_binding,
		loaded_handler,
		error_handler,
		warning_handler
	];
}

class Sandbox extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			data: 0,
			code: 1,
			owner_properties: 2,
			owner: 3,
			sandbox_props: 4,
			version: 6,
			getProxy: 7
		});
	}

	get version() {
		return this.$$.ctx[6];
	}

	get getProxy() {
		return this.$$.ctx[7];
	}
}

export default Sandbox;
