# @non25/svelte-loader

Fork of a [webpack](https://webpack.js.org) loader for [svelte](https://svelte.dev) with bugs fixed.

Webpack 4 & 5 are supported.

## Install

On the existing project, make sure to have following packages:

```
npm install -D svelte @non25/svelte-loader svelte-preprocess postcss postcss-import postcss-load-config
```

## Usage

Here's full-featured configuration with hot module replacement:

```javascript
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const sveltePreprocess = require('svelte-preprocess');
const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';
  ...
  resolve: {
    // include only one version of svelte runtime
    alias: {
      svelte: path.resolve('node_modules', 'svelte')
    },

    // import .svelte files without extension
    extensions: ['.mjs', '.js', '.svelte'],

    // use sources of third-party svelte packages
    mainFields: ['svelte', 'browser', 'module', 'main']
  },
  module: {
    rules: [
      ...
      {
        test: /\.svelte$/,
        use: {
          loader: '@non25/svelte-loader',
          options: {
            compilerOptions: {
              // required by hot module replacement (HMR)
              dev: !prod,
            },

            // enable emitCss only for production
            emitCss: prod,

            // enable HMR only for development
            hotReload: !prod,

            // inline css imports in svelte components for equal dev/prod using postcss
            preprocess: sveltePreprocess({
              postcss: true
            })
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          // make separate css bundle
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      ...
    ]
  },
  ...
  // enable sourcemaps in devmode
  devtool: prod ? false : 'source-map',
  ...
  plugins: [
    // make separate css bundle
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    ...
  ]
  ...
```

Create `postcss.config.js` for inlining css `@import`s:

```javascript
module.exports = {
  plugins: [
    require('postcss-import')
  ]
}
```

If you have `postcss.config.js` already, then you may want to prevent emitted svelte component's css from getting processed twice. Read more [here](#css-import-in-components).

Check out the [example project](https://github.com/sveltejs/template-webpack).

### resolve.alias

The [`resolve.alias`](https://webpack.js.org/configuration/resolve/#resolvealias) option is used to make sure that only one copy of the Svelte runtime is bundled in the app, even if you are `npm link`ing in dependencies with their own copy of the `svelte` package. Having multiple copies of the internal scheduler in an app, besides being inefficient, can also cause various problems.

### resolve.mainFields

Webpack's [`resolve.mainFields`](https://webpack.js.org/configuration/resolve/#resolve-mainfields) option determines which fields in package.json are used to resolve identifiers. If you're using Svelte components installed from npm, you should specify this option so that your app can use the original component source code, rather than consuming the already-compiled version (which is less efficient).

### Svelte Compiler options

You can pass [available options](https://svelte.dev/docs#svelte_compile) directly to the svelte compiler in `compilerOptions`.

`dev` option is used in the development mode to improve debugging and because HMR requires it.

### emitCss

By default css from component's `<style>` tag will be injected by compiler-generated JavaScript when component is rendered. `emitCss` creates a virtual css file for each svelte component with `<style>` tag and adds corresponding import, which then gets processed by `css-loader`. [MiniCssExtractPlugin](https://github.com/webpack-contrib/mini-css-extract-plugin/) then makes separate css bundle from all css imports in your project, allowing to fetch style & code in parallel.

Warning: in production, if you have set `sideEffects: false` in your `package.json`, `MiniCssExtractPlugin` has a tendency to drop CSS, regardless of whether it's included in your svelte components.

Alternatively, if you're handling styles in some other way and just want to prevent the CSS being added to your JavaScript bundle, put `css: false` in `compilerOptions`.

### Source maps

JavaScript source maps are enabled by default, you just have to use an appropriate [webpack devtool](https://webpack.js.org/configuration/devtool/).

To enable CSS source maps, you'll need to use `emitCss` and pass the `sourceMap` option to the `css-loader`. 

You'll have to choose to either opt out from HMR or from css source maps in dev mode, because HMR is incompatible with `emitCss`.

```javascript
      ...
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              // this will work with HMR, source maps in production
              sourceMap: prod
            }
          }
        ]
      },
      ...
```

This should create an additional `[name].css.map` file.

### Hot Module Replacement

This loader supports component-level HMR via the community supported [svelte-hmr](https://github.com/rixo/svelte-hmr) package. This package serves as a testbed and early access for Svelte HMR, while we figure out how to best include HMR support in the compiler itself (which is tricky to do without unfairly favoring any particular dev tooling). Feedback, suggestion, or help to move HMR forward is welcomed at [svelte-hmr](https://github.com/rixo/svelte-hmr/issues) (for now).

HMR expects that you use either [HotModuleReplacementPlugin](https://webpack.js.org/plugins/hot-module-replacement-plugin) or [devServer](https://webpack.js.org/configuration/dev-server).

Configure inside your `webpack.config.js`:

```javascript
          ...
          options: {
            ...
            hotReload: !prod,
            hotOptions: {
              // put options for svelte-hmr here
            }
            ...
          }
  ...
  // either this
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    ...
  ],
  ...
  // or this
  devServer: {
    hot: true
  }
}
```

### CSS @import in components

It is advised to inline any css `@import` in component's style tag before it hits `css-loader`.

This ensures equal css behavior when using HMR with `emitCss: false` and production.

If you are using autoprefixer for `.css`, then it is better to exclude emitted css, because it was already processed with `postcss` through `svelte-preprocess` before emitting.

```javascript
  ...
  module: {
    rules: [
      ...
      {
        test: /\.css$/,
        exclude: /svelte\.\d+\.css/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.css$/,
        include: /svelte\.\d+\.css/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      ...
    ]
  },
  ...
```

This ensures that global css is being processed with `postcss` through webpack rules, and svelte component's css is being processed with `postcss` through `svelte-preprocess`.

## License

MIT
