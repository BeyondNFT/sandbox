<script>
  import { createEventDispatcher } from 'svelte';

  import Viewer from './Output/Viewer.svelte';

  const dispatch = createEventDispatcher();

  export let data = {};
  export let code = '';
  export let owner_properties = [];
  export let sandbox_props = '';

  let proxy = null;

  export function getProxy() {
    return proxy;
  }

  if (!code && data.interactive_nft) {
    if (data.interactive_nft.code) {
      code = data.interactive_nft.code;
      // so it won't be a problem when JSON.stringified
      // and we don't need it in the code itself
      data.interactive_nft.code = null;
    } else if (data.interactive_nft.code_uri) {
      fetch(data.interactive_nft.code_uri)
        .then((res) => res.text())
        .then((_code) => (code = _code))
        .catch((e) => {
          dispatch(
            'Error',
            new Error(`Error while fetching ${data.interactive_nft.code_uri}`)
          );
        });
    } else {
      dispatch(
        'Error',
        new Error('You need to provide code for this NFT to run')
      );
    }
  } else {
    dispatch(
      'Error',
      new Error('You need to provide code for this NFT to run')
    );
  }
</script>

{#if code}
  <Viewer
    {code}
    {owner_properties}
    {sandbox_props}
    json={data}
    bind:proxy
    on:loaded
    on:error />
{:else}Loading...{/if}
