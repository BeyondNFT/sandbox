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

export default class Proxy {
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
