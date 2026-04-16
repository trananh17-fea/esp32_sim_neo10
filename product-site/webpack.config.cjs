const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const Dotenv = require("dotenv-webpack");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const isDev = argv.mode !== "production";

  return {
  mode: isDev ? "development" : "production",
  entry: path.resolve(__dirname, "src/main.tsx"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: isDev ? "static/js/[name].js" : "static/js/[name].[contenthash:8].js",
    chunkFilename: isDev ? "static/js/[name].chunk.js" : "static/js/[name].[contenthash:8].chunk.js",
    publicPath: isDev ? "/" : "./",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          isDev ? "style-loader" : MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [
                  require("tailwindcss"),
                  require("autoprefixer"),
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
        type: "asset",
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
        generator: {
          filename: "static/images/[name].[hash:8][ext]",
        },
      },
      {
        test: /\.(mp4|webm|ogg)$/i,
        type: "asset/resource",
        generator: {
          filename: "static/media/[name].[hash:8][ext]",
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        generator: {
          filename: "static/fonts/[name].[hash:8][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "public/index.html"),
      inject: true,
      ...(isDev
        ? {}
        : {
            minify: {
              removeComments: true,
              collapseWhitespace: true,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true,
            },
          }),
    }),
    new Dotenv({
      systemvars: true,
      safe: false,
      silent: true,
    }),
    ...(isDev
      ? []
      : [
          new MiniCssExtractPlugin({
            filename: "static/css/[name].[contenthash:8].css",
            chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
          }),
          new CopyWebpackPlugin({
            patterns: [
              {
                from: "public",
                to: ".",
                globOptions: {
                  ignore: ["**/index.html"],
                },
                noErrorOnMissing: true,
              },
            ],
          }),
        ]),
  ],
  optimization: isDev
    ? {}
    : {
        minimize: true,
        minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
            },
          },
        },
      },
  devServer: {
    static: {
      directory: path.resolve(__dirname, "public"),
    },
    historyApiFallback: true,
    port: 8082,
    hot: true,
    open: true,
    compress: true,
  },
  devtool: isDev ? "eval-cheap-module-source-map" : "source-map",
  performance: {
    hints: isDev ? false : "warning",
    maxAssetSize: 512 * 1024,
    maxEntrypointSize: 512 * 1024,
  },
};
};