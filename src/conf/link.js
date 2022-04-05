let ipfsGateway = '';
export default {
  init(gateway) {
    ipfsGateway = gateway;
  },

  process(link) {
    return link
      .replace('ipfs://ipfs/', 'ipfs://')
      .replace('ipfs://', ipfsGateway);
  },
};
