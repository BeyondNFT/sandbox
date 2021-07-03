import mitt from 'mitt';
import IPFS from '../conf/link';

import * as utils from './utils.js';
import srcdoc from './srcdoc/index.js';

const emitter = mitt();

export default {
  emitter,
  json: {},
  code: '',
  owner_properties: {},
  owner: '',
  async init(json, code, owner_properties, owner, ipfsGateway, fetch) {
    if (ipfsGateway) {
      IPFS.init(ipfsGateway);
    }

    if ('string' === typeof json) {
      try {
        json = JSON.parse(json);
      } catch (e) {
        json = IPFS.process(json);
        await fetch(json)
          .then((res) => res.json())
          .then((_data) => (json = _data))
          .catch((e) => {
            emitter.emit(
              'warning',
              new Error(`Error while fetching NFT's JSON at ${json}`),
            );
            json = null;
          });
      }
    }

    if (!json) {
      emitter.emit(
        'error',
        new Error(`You need to provide a json property.
			Either a valid uri to the NFT JSON or the parsed NFT JSON.`),
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
            emitter.emit(
              'warning',
              `Error while fetching owner_properties on ${owner_properties}.
						Setting owner_properties to default.`,
            );
            owner_properties = {};
          });
      }
    }

    // get code from interactive_nft
    if (!code && json.interactive_nft) {
      if (json.interactive_nft.code) {
        code = json.interactive_nft.code;
        // if the code is in the interactive_nft property (not recommended)
        // we delete it because it might be a problem when we pass this object to the iframe
        // because we have to stringify it
        json.interactive_nft.code = null;
      } else if (json.interactive_nft.code_uri) {
        await fetch(IPFS.process(json.interactive_nft.code_uri))
          .then((res) => res.text())
          .then((_code) => (code = _code))
          .catch((e) => {
            emitter.emit(
              'Error',
              new Error(
                `Error while fetching ${json.interactive_nft.code_uri}`,
              ),
            );
          });
      }
    }

    if (!code) {
      emitter.emit(
        'Error',
        new Error('You need to provide code for this NFT to run'),
      );
    }

    this.json = json;
    this.code = code;
    this.owner_properties = owner_properties;
    this.owner = owner;
  },

  build() {
    return this.replaceCode(srcdoc);
  },

  makeDependencies() {
    if (!this.json.interactive_nft) {
      return '';
    }
    return utils.makeDependencies(this.json.interactive_nft.dependencies);
  },

  loadProps() {
    const props = {};
    if (this.json.interactive_nft) {
      if (Array.isArray(this.json.interactive_nft.properties)) {
        let overrider = {};
        if (
          this.owner_properties &&
          'object' === typeof this.owner_properties
        ) {
          overrider = this.owner_properties;
        }

        // no Object.assign because we only want declared props to be set
        for (const prop of this.json.interactive_nft.properties) {
          props[prop.name] = prop.value;
          if (undefined !== overrider[prop.name]) {
            props[prop.name] = overrider[prop.name];
          }
        }
      }
    }

    return props;
  },

  replaceCode(srcdoc) {
    let content = this.makeDependencies();

    const props = this.loadProps();

    content += utils.scriptify(`
		// specific p5 because it's causing troubles.
		if (typeof p5 !== 'undefined' && p5.disableFriendlyErrors) {
			p5.disableFriendlyErrors = true;
			new p5();
		}

    window.context = {
      get owner() {
        let owner = owner;
        if (window.location?.search) {
          const params =  new URLSearchParams(window.location.search);
          owner = params.get('owner') || owner;
        }
        return owner;
      },
      nft_json: JSON.parse(${JSON.stringify(JSON.stringify(this.json))}),
      properties: JSON.parse('${JSON.stringify(props)}'),
    };
	`);

    content += this.code;

    return srcdoc.replace('<!-- NFTCODE -->', content);
  },
};
