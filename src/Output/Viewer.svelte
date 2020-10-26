<script>
  import { createEventDispatcher, onMount } from 'svelte';

  import Proxy from './Proxy';
  import srcdoc from './srcdoc/index.js';
  import * as utils from './utils.js';

  export let code = '';
  export let proxy;
  export let json;
  export let owner_properties;
  export let sandbox_props = '';

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
    proxy = new Proxy(iframe, {
      on_fetch_progress: (progress) => {
        pending_imports = progress;
      },
      on_error: (event) => {
        push_logs({ level: 'error', args: [event.value] });
        show_error(event.value);
      },
      on_unhandled_rejection: (event) => {
        let error = event.value;
        if (typeof error === 'string') error = { message: error };
        error.message = 'Uncaught (in promise): ' + error.message;
        push_logs({ level: 'error', args: [error] });
        show_error(error);
      },
      on_console: (log) => {
        if (log.level === 'clear') {
          clear_logs();
          push_logs(log);
        } else if (log.duplicate) {
          increment_duplicate_log();
        } else {
          push_logs(log);
        }
      },
      on_console_group: (action) => {
        group_logs(action.label, false);
      },
      on_console_group_end: () => {
        ungroup_logs();
      },
      on_console_group_collapsed: (action) => {
        group_logs(action.label, true);
      },
    });

    iframe.addEventListener('load', () => {
      proxy.handle_links();
      !error && dispatch('loaded');
    });

    return () => {
      proxy.destroy();
    };
  });

  function makeDependencies() {
    if (!json.interactive_nft) {
      return '';
    }
    return utils.makeDependencies(json.interactive_nft.dependencies);
  }

  function loadProps() {
    const props = {};
    if (json.interactive_nft) {
      if (Array.isArray(json.interactive_nft.properties)) {
        // default props
        for (const prop of json.interactive_nft.properties) {
          props[prop.name] = prop.value;
        }

        // current owner props overriding default props
        if (owner_properties && 'object' === typeof owner_properties) {
          for (const propName in owner_properties) {
            props[propName] = owner_properties[propName];
          }
        }
      }
    }

    return props;
  }

  function replaceCode(srcdoc) {
    let content = makeDependencies();

    const props = loadProps();

    const injectedProps = `
      window.context.properties = JSON.parse('${JSON.stringify(props)}');
    `;

    const injectedJSON = `
      window.context.nft_json = JSON.parse(${JSON.stringify(
        JSON.stringify(json)
      )});
    `;

    content += utils.scriptify(`
      // specific p5 because it's causing troubles.
      if (typeof p5 !== 'undefined' && p5.disableFriendlyErrors) {
        p5.disableFriendlyErrors = true;
        new p5();
      }

      ${injectedProps}
      ${injectedJSON}
    `);

    content += code;

    return srcdoc.replace('<!-- NFTCODE -->', content);
  }

  function show_error(e) {
    error = e;
    dispatch('error', e);
  }

  function push_logs(log) {
    current_log_group.push((last_console_event = log));
    logs = logs;
  }

  function group_logs(label, collapsed) {
    const group_log = { level: 'group', label, collapsed, logs: [] };
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
</script>

<style>
  .beyondnft__sandbox {
    background-color: white;
    border: none;
    width: 100%;
    height: 100%;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  .greyed-out {
    filter: grayscale(50%) blur(1px);
    opacity: 0.25;
  }
</style>

<!--
-->
<div class="beyondnft__sandbox">
  <iframe
    title="Sandbox"
    bind:this={iframe}
    sandbox={`allow-scripts allow-pointer-lock allow-popups ${sandbox_props}`}
    class={error || pending || pending_imports ? 'greyed-out' : ''}
    srcdoc={replaceCode(srcdoc)} />
</div>
