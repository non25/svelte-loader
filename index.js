const { relative } = require('path');
const { getOptions } = require('loader-utils');
const { buildMakeHot } = require('./lib/make-hot.js');
const { compile, preprocess } = require('svelte/compiler');

function posixify(file) {
	return file.replace(/[/\\]/g, '/');
}

const virtualModules = new Map();
let indexes = {};

function getIndex(resource) {
	if (!indexes[resource]) {
		indexes[resource] = 0;
	}
	indexes[resource] += 1;
	return indexes[resource];
}

module.exports = function(source, map) {
	this.cacheable();

	const options = { ...getOptions(this) };
	const callback = this.async();

	if (options.cssPath) {
		const css = virtualModules.get(options.cssPath);
		virtualModules.delete(options.cssPath);
		callback(null, css);
		return;
	}

	const isServer = this.target === 'node' || (options.compilerOptions && options.compilerOptions.generate == 'ssr');
	const isProduction = this.minimize || process.env.NODE_ENV === 'production';

	const compileOptions = {
		filename: this.resourcePath,
		css: !options.emitCss,
		...options.compilerOptions,
		format: (options.compilerOptions && options.compilerOptions.format) || 'esm'
	};

	const handleWarning = warning => this.emitWarning(new Error(warning));

	options.preprocess = options.preprocess || {};
	options.preprocess.filename = compileOptions.filename;

	preprocess(source, options.preprocess).then(processed => {
		if (processed.dependencies && this.addDependency) {
			for (let dependency of processed.dependencies) {
				this.addDependency(dependency);
			}
		}

		if (processed.map) compileOptions.sourcemap = processed.map;

		const compiled = compile(processed.toString(), compileOptions);
		let { js, css, warnings } = compiled;

		if (!js.map.sourcesContent) {
			js.map.sourcesContent = [source];
			js.map.sources = [compileOptions.filename];
		}

		warnings.forEach(
			options.onwarn
				? warning => options.onwarn(warning, handleWarning)
				: handleWarning
		);

		if (options.hotReload && !isProduction && !isServer) {
			const hotOptions = { ...options.hotOptions };
			const makeHot = buildMakeHot(hotOptions);
			const id = JSON.stringify(relative(process.cwd(), compileOptions.filename));
			js.code = makeHot(id, js.code, hotOptions, compiled, source, compileOptions);
		}

		if (options.emitCss && css.code) {
			const resource = posixify(compileOptions.filename);
			const index = getIndex(resource);
			const cssPath = `${resource}.${index}.css`;
			css.code += '\n/*# sourceMappingURL=' + css.map.toUrl() + '*/';
			js.code += `\nimport '${cssPath}!=!@non25/svelte-loader?cssPath=${cssPath}!${resource}'\n;`;
			virtualModules.set(cssPath, css.code);
		}

		callback(null, js.code, js.map);
	}, err => {
		this.addDependency(err.file);
		callback(err);
	}).catch(err => {
		// wrap error to provide correct
		// context when logging to console
		callback(new Error(`${err.name}: ${err.toString()}`));
	});
};
