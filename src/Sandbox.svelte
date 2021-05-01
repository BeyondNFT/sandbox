<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Builder from './Builder';

  import Viewer from './Output/Viewer.svelte';

  const dispatch = createEventDispatcher();

  export let data = {};
  export let code = '';
  export let owner_properties = {};
  export let owner = '0x0000000000000000000000000000000000000000';
  export let sandbox_props = '';
  export let ipfsGateway = 'https://gateway.ipfs.io/';

  export const version = process.env.npm_package_version;

  let proxy = null;
  let ready = false;

  export function getProxy() {
    return proxy;
  }

  export function getBuilder() {
    return builder;
  }

  Builder.emitter.on('warning', (e) => dispatch('warning', e.detail));
  Builder.emitter.on('error', (e) => dispatch('error', e.detail));

  onMount(async () => {
    await Builder.init(data, code, owner_properties, owner, ipfsGateway, fetch);
    ready = true;
  });
</script>

{#if ready}
  <Viewer
    src={Builder.build()}
    {sandbox_props}
    bind:proxy
    on:loaded
    on:error
    on:warning
  />
{:else}Loading...{/if}
