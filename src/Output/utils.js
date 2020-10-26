export function makeDependencies(dependencies) {
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

export function scriptify(script) {
  return `<script type="text/javascript">${script}</script>`;
}
