# BeyondNFT - Interactive NFT Sandbox

*This was developed for the Untitled NFT Hackaton while working on a safe and hopefully in the future standard way to create interactive NFTs.*

This project is the open source Sandbox for loading and viewing Interactive NFTs.

If you're just looking to easily embed NFTs, you might be looking for the [BeyondNFT/embeddable](https://github.com/BeyondNFT/embeddable) project. This project is more an "in deep" presentation of what are Interactive NFTs and how they work.

The Sandbox has no idea about the existence of the Blockchain (it works with JSON already loaded), when [BeyondNFT/embeddable](https://github.com/BeyondNFT/embeddable) makes direct calls to the smart contracts to get all the data needed.

This is the good place to see [the end schema](#usage) of InteractiveNFT's JSON, which can guide platforms into creating their own Sandbox if they do not trust this one.

## "Glossary"

**Creator**: the entity (Artist, Developer, Platform, ...) who created the NFT.
**Owner**: the current NFT owner.
**Viewer**: the person viewing the NFT (might be any user, including Creator or Owner).


## Disclaimer

What follows in mainly for developers to know what the Sandbox expects for properties to work and to participate to the development of this (maybe?) new standard.

As a **Creator** or an **Owner**, you should probably never have to edit any of those values by hand. The tools provided by the platform you used to create Interactive NFTs should be enough.

If like me, you prefer reading code with comments better than long walls of text, just [jump to Usage](#usage)


## Descriptions

### Interactive NFTs

Interactive NFT is a project that aims to:
- Allow NFTs to be non static and/or interactives to the **Viewer** (procedural art with js, html, external data call, music player, video player...).
- Allow a **Creator** to declare some values "configurable/variables" and an **Owner** to configure those values, making the NFT evolve.

This way, an Artist could for example create a procedural piece of art, and allow the futur **Owners** to set some key values used during the art rendering, thus making the Art evolutive.
The **Owner** could for example edit colors, animation durations, texts, textures or anything that the **Creator** declared as editable.

Another example would be a Card on which the **Viewer** could click; the card would then flip and present its attributes (that are stored in the NFT's JSON or even retrieven with an ajax call). All this directly in a Gallery / Website / Marketplace.

### Sandbox

This Sandbox aims to display the NFT code in a safe way for the **Viewer**.
For Security reasons, the NFT Code is sandboxed in an iframe, using srcdoc.
By default, only "allow-script", "allow-pointer-lock" and "allow-popups" are enabled. So no access to parent context or same origin stuffs (cookies, localStorage & co).

- [MDN iframe (see sandbox)](https://developer.mozilla.org/fr/docs/Web/HTML/Element/iframe)
- [Play safely in a sandbox](https://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/)

_Idea (but only idea, this is risky and would need to be handled with a lot of care): Create a system of Permissions, allowing **Creators** to request some permissions that the **Viewer** would have to accept or decline._

## Interactive how?

### "Hey I'm interactive"

The idea is to have a property `interactive_nft` in the NFT's JSON that declares the NFT as an interactive NFT.
This propery references where to find the code, the dependencies, the default configuration (if any) etc...

#### Version

Under `interactive_nft.version` must be declared the version of the interactive NFT used. This in order to help Sandboxed in the futur to know how to render the NFT, if the "standard" comes to evolve.

#### Code

The code of the NFT. It is expected to be **VALID HTML** that will be inserted at the end of the iframe's `body` tag.

There are 2 ways to declare code in the `interactive_nft`.

- **(recommended)** as an URI under `interactive_nft.code_uri`(1) . The Sandbox will detect this property, fetch the URI  as a text file and use the content as the NFT code.
- (not recommended) As a string under `interactive_nft.code`. The Sandbox will also use this code as the NFT code. However, because the code is HTML and can contain special characters that are not playing well with JSON, it is recommended to not save the code directly into the NFT JSON, and to use the `code_uri` property instead. `interactive_nft.code` is mainly here to be used when creating the NFTs, because the code won't be hosted already.

This gives a huge flexibility to **Creators**. They can then add HTML, JavaScript and CSS to the NFT.

```html
<style>.foo { font-size: 3rem; }</style>
<div class="foo"></div>
<script type="text/javascript">
  document.querySelector('.foo').innerText = "Hello world!";
</script>
```

is a perfectly fine NFT code.

(1) preferably hosted somewhere on a decentralized host (IPFS, Arweave or the like).

#### Dependencies

Dependencies are declared under `interactive_nft.dependencies`.
It is an array of object of the form : { url: String, type: String }
When loading the NFT, the Sandbox will add the dependencies into `script` and `style` tags in the iframe before the NFT code.

JSON Schema
```json
{
  "title": "Interactive NFT Dependencies",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {,
      "required": ["type", "url"],
      "type": {
        "type": "string",
        "enum": ["script", "style"],
        "description": "Type of the dependency (script or style tag)."
      },
      "url": {
        "type": "string",
        "description": "URL of the dependency."
      }
    }
  }
}
```

Example:

```json
{
  "name": "Interactive NFT #1",
  "description": "The first of its kind.",
  "image": "http://gateway.ipfs.io/Qxn...",
  "interactive_nft": {
    "code_uri": "http://gateway.ipfs.io/Qxn...",
    "dependencies": [{
      "type": "script",
      "url": "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js"
    }, {
      "type": "style",
      "url": "https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css"
    }]
  }
}
```

#### Configurable

***Contract implementing configurable InteractiveNFTs are expected to provide a public method `interactiveConfURI(_tokenId, _owner) public returns (string)` which works for both ERC721 and ERC1155, and returns the conf URI for a tokenId (if set by the Owner).
It should also be paired with a setter method `setInteractiveConfURI(_tokenId, _uri)` for **Owners** to be able to set the URI*** [see ERC721Configurable](#erc721configurable)

If the **Creator** declared some configurable properties, they **MUST** have a default value: this to be able to reset configuration if anything is wrongly configured.

Configurable properties are declared under `interactive_nft.properties`.
It is an Array of Objects of the form { name: String, type: String, value: String|Number|Array|Object }

JSON Schema
```json
{
  "title": "Interactive NFT Configurable Properties",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "required": ["name", "type", "value"],
      "name": {
        "type": "string",
        "description": "Name of the property.",
      },
      "type": {
        "type": "string",
        "enum": ["string", "number", "array", "object"],
        "description": "Type of the property.",
      },
      "value": {
        "type": ["string", "number", "array", "object"],
        "description": "This is the default value. May be a string, number, object or array.",
      },
      "description": {
        "type": "string",
        "description": "Description of what the property is used for. Might be needed if name not explicit enough.",
      }
    }
  }
}
```

Example:

```json
{
  "name": "Interactive NFT #1",
  "description": "The first of its kind.",
  "image": "http://gateway.ipfs.io/Qxn...",
  "interactive_nft": {
    "code_uri": "http://gateway.ipfs.io/Qxn...",
    "properties": [{
      "name": "duration",
      "type": "number",
      "value": 500,
      "description": "Animation duration"
    },
    {
      "name": "name",
      "type": "string",
      "value": "John Doe",
      "description": "Your cat name",
    },
    {
      "name": "fruits",
      "type": "array",
      "value": ["orange", "banane"],
      "description": "Your favorite fruits",
    },
    {
      "name": "fullname",
      "type": "object",
      "value": {
        "name": "Doe",
        "surname": "John"
      },
      "description": "Your cat fullname",
    }]
  }
}
```

_(What follows is automatically done when using [BeyondNFT/embeddable](https://github.com/BeyondNFT/embeddable) to show interactive NFTs to **Viewers**.)_

When loading the NFT Metadata, the platform showing the NFT to the **Viewers** should check the existence of this `interactive_nft.properties`, and, if defined, should call the NFT contract `interactiveConfURI(_tokenId, _owner)` to see if the current NFT owner has a configuration file for this NFT.

If a configuration file exists, **its content as a JavaScript object** will be expected to be passed to the sandbox under `owner_properties` ([see usage](#usage))

When detecting `interactive_nft.properties`, the Sandbox will automatically search for `owner_properties`.
It will then override `interactive_nft.properties` with `owner_properties` and write the whole properties object to `window.context.properties`. It will then be accessible in the js code using `const propValue = window.context.properties[propertyName];`

There is nothing that forces the configuration file to be on IPFS or any decentralized network.
Platform could just mint the NFT with an URI to an empty configuration JSON that they host on their server (e.g `http://mynftplatform.com/tokens/0xcontract/{id}.config.json`), or **Owners** could just set the configuration file to any raw gist.
This way, when the **Owner** wants to edit some values, they can do it without having to do a new transaction because they already have control over the configuration file (either through gist or through the platform editing the NFTs).
It is sure less decentralized, but it saves the cost of transactions and the **Owner** can always set the URI stored in the contract to another URI, having full control over the file.

##### Configurable Types

As of now, accepted types are 'string', 'number', 'object' and 'array' (see [Usage](#usage))

## Usage

This Sandbox is to be used as follow:

`new SandBox({ target, props })`

Construction parameter is an Object with two required properties :

`target`: an HTML element where to render the Sandbox
`props`: An object of properties read by the Sandbox


Full example of usage, because code is ten times better than words (You can also see [./public/index.html](./public/index.html) to see another one)

```js
const sandbox = new SandBox({
  target: document.querySelector('#viewer'),
  props: {
    // data: required
    // This is a JavaScript object, usually the result of JSON.parse of the content of tokenURI
    // the Sandbox will look for the `interactive_nft` property
    // this whole JSON will also be available in the iframe as a JavaScript object
    // under `window.context.nft_json` so the code can read data from it (for example to get properties)
    data: {
      name: 'Interactive NFT #1',
      description: "The first of its kind.",,
      image: "http://gateway.ipfs.io/Qxn...",

      // interactive_nft: required (for InteractiveNFT)
      // this is the property the Sandbox will look for in order to render the NFT
      interactive_nft: {
        // code_uri (optional) - URI where to find the code to execute
        code_uri: 'ipfs://Qx....',

        // code (optional) (non recommended, mostly used when creating the NFT in a codepen-like env)
        code: '<script>console.log("here");</script>',

        // version: required
        // version of the Sandbox used to create this interactive NFT, might be important at some point
        // if the way the sandbox works changes a lot, we will need to know what Sandbox to use to load
        // the NFT
        version: '0.0.1',

        // dependencies: optional
        // Array of dependencies that the Sandbox should load before executing the NFT code.
        //
        // @dev When a creator makes an NFT with dependencies, please show a reminder that if the
        // dependencies break (404, cdn stops working, ...) the NFT will not work anymore
        // Maybe offer to host those on IPFS?!
        dependencies: [
          {
            // type: required (script|style)
            // type of the dependency, will define how it is handled by the Sandbox
            type: 'script',

            // url: required
            // url where to find the dependency
            url: 'https://cdn.jsdelivr.net/npm/p5@1.1.9/lib/p5.js',
          },
          {
            type: 'style',
            url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@100&display=swap',
          },
          // ...
        ],

        // properties: optional
        // an array of configurable properties
        // those properties are here to configure the NFT rendering
        // because those are the one the Owner of the NFT can modify and store somewhere
        // for them to be loaded when users are viewing their NFT
        // These values will be set in window.context.properties and be accessed inf the NFT Javascript as follow
        // `const propertyValue = window.context.properties[propertyName]`;
        properties: [{
            // name: required
            // name of the property
            name: "duration",

            // type: required
            // type of the property, can be number, string, array or object
            // mainly for configuration editors to know what they deal with
            type: "number",


            // value: required
            // this is the default value of the property.
            // @dev if is very important to have a value here, because if an owner "breaks" their NFT by saving a boggus configuration file, this value can be used to recreate a default configuration file that won't break the NFT. even empty values ('', 0, [], {}) should be enough
            value: 500,

            // description: optional
            // small text describing what this value is used for.
            // might be needed if the name is not explicit enough
            description: "Duration of the animation"
          },
          {
            name: "name",
            type: "string",
            value: "John Doe"
          },
          {
            name: "fruits",
            type: "array",
            value: ["orange", "banane"]
          },
          {
            name: "fullname",
            type: "object",
            value: {
              name: "Doe",
              surname: "John"
            }
          }
          // ...
        ]
      }
    },
    // owner_properties: optional
    // object containing all the properties the Owner configured
    // this should be the content of the NFT's stored configuration file (if set by the owner and NFT is configurable)
    // the Sandbox will override the default props with the values in here, making the NFT
    // configurable by its owner
    owner_properties: {
      duration:  3000,
      name: 'Jane Doe',
      fruits: ['kiwi', 'strawberries'],
      fullname: {
        name: "Doe",
        surname: "Jane"
      }
    }
  }
});
```

## External Events

The Sandbox dispatch events to let you know what happens inside.
You can listen to those events using `sandboxnInstance.$on(eventName, fn)`

For the moment, events are:

`loaded`: when the Sandbox loaded all dependencies, created the configuration object and added the code to the iframe (and it didn't throw an error)

`error`: When any `unhandledrejection` happens in the iframe. The iframe content will blur and stop any interaction if that happens (@TODO: reflect whether to make this configurable directly when instantiating the sandbox?!)


## User Warning

Executing "user submitted" code is always a bit tricky.

Using a Sandboxed iframe should already help to stop a lot of problem that can happen, but still, users should be warned to not do anything that seems suspicious when the NFT runs.

Therefore, if you use this Sandbox on your website, before the first rendering it would be nice to tell users that they will be shown an Interactive NFT and that they must be carefull because you do not have control over the code itself.

@TODO: Should we set that directly in the Sandbox?

## Development

Feel free to help develop or correct bug as this is highly POC for the moment.

The sandbox is created using [Svelte](http://svelte.dev) (because... what else?).

`npm run build` to build the Sandbox code

`npm run dev` to edit with a watch (autoreload and so on).

`npm run srcdoc` after modifying [the iframe html](./src/Output/srcdoc/index.html) in dev mode (automatically done before a build)

`npm run start` will serve the files under public, which let you play a bit with the Sandbox if you edit [./public/index.html](./public/index.html)

## ERC721Configurable

Basic ERC721Configurable methods

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract ERC721Configurable {
    // map of tokenId => interactiveConfURI.
    mapping(uint256 => string) private _interactiveConfURIs;

    function _setInteractiveConfURI(
        uint256 tokenId,
        string calldata _interactiveConfURI
    ) internal virtual {
        require(
            _exists(tokenId),
            "ERC721Configurable: Configuration URI for unknown token"
        );
        _interactiveConfURIs[tokenId] = _interactiveConfURI;
    }

    /**
     * Configuration uri for tokenId
     */
    function interactiveConfURI(uint256 tokenId)
        public
        virtual
        view
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Configurable: Configuration URI query for unknown token"
        );
        return _interactiveConfURIs[tokenId];
    }
}
```