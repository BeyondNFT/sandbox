<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import IPFS from './conf/link';

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

  $: IPFS.init(ipfsGateway);

  export function getProxy() {
    return proxy;
  }

  onMount(async () => {
    if ('string' === typeof data) {
      await fetch(IPFS.process(data))
        .then((res) => res.json())
        .then((_data) => (data = _data))
        .catch((e) => {
          dispatch(
            'warning',
            new Error(`Error while fetching NFT's JSON at ${data}`)
          );
          data = null;
        });
    }

    if (!data) {
      dispatch(
        'error',
        new Error(`You need to provide a data property.
      Either a valid uri to the NFT JSON or the parsed NFT JSON.`)
      );
      return;
    }

    // first fetch owner_properties if it's an URI
    if (owner_properties) {
      if ('string' === typeof owner_properties) {
        await fetch(IPFS.process(owner_properties))
          .then((res) => res.json())
          .then((_owner_properties) => (owner_properties = _owner_properties))
          .catch((e) => {
            dispatch(
              'warning',
              `Error while fetching owner_properties on ${owner_properties}.
            Setting owner_properties to default.`
            );
            owner_properties = {};
          });
      }
    }

    // get code from interactive_nft
    if (!code && data.interactive_nft) {
      if (data.interactive_nft.code) {
        code = data.interactive_nft.code;
        // if the code is in the interactive_nft property (not recommended)
        // we delete it because it might be a problem when we pass this object to the iframe
        // because we have to stringify it
        data.interactive_nft.code = null;
      } else if (data.interactive_nft.code_uri) {
        await fetch(IPFS.process(data.interactive_nft.code_uri))
          .then((res) => res.text())
          .then((_code) => (code = _code))
          .catch((e) => {
            dispatch(
              'Error',
              new Error(`Error while fetching ${data.interactive_nft.code_uri}`)
            );
          });
      }
    }

    if (!code) {
      dispatch(
        'Error',
        new Error('You need to provide code for this NFT to run')
      );
    }
  });
</script>

{#if code}
  <Viewer
    {code}
    {owner_properties}
    {sandbox_props}
    {owner}
    json={data}
    bind:proxy
    on:loaded
    on:error
    on:warning
  />
{:else}Loading...{/if}
