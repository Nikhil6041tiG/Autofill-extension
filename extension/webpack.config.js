const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const webpack = require('webpack');
const dotenv = require('dotenv');

// Load env vars from .env file
const env = dotenv.config().parsed || {};

// Reduce it to a nice object, the same as before ("process.env.X" = "value")
const envKeys = Object.keys(env).reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(env[next]);
    return prev;
}, {});

module.exports = {
    entry: {
        background: './src/background/index.ts',
        content: './src/content/index.ts',
        onboarding: './src/pages/onboarding/index.tsx',
        settings: './src/pages/settings/index.tsx',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
        publicPath: '', // Fix: Chrome extensions don't support automatic publicPath
    },
    // Disable source maps to prevent CSP violations (no eval allowed in Chrome extensions)
    devtool: false,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
            ],
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/onboarding/onboarding.html',
            filename: 'onboarding.html',
            chunks: ['onboarding'],
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/settings/settings.html',
            filename: 'settings.html',
            chunks: ['settings'],
        }),
        new webpack.DefinePlugin({
            ...envKeys,
            'process.env.REACT_APP_AI_URL': JSON.stringify(process.env.REACT_APP_AI_URL || 'http://localhost:8001'),
            'process.env.REACT_APP_BACKEND_URL': JSON.stringify(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000')
        })
    ],
};
