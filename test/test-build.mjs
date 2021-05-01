import NftSandbox from '../dist/nftsandbox.umd.js';
import fetch from 'cross-fetch';

const Builder = NftSandbox.Builder;

Builder.emitter.on('warning', console.log);
Builder.emitter.on('error', console.log);
Builder.init(
  'ipfs://ipfs/QmVzAT4YoRuDY65KMTW6569xEKKFygf64N2UrXLRGLJ38F',
  '',
  {},
  '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
  'https://gateway.pinata.cloud/',
  fetch,
).then(() => console.log(Builder.build()));
