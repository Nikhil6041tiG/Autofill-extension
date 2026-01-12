declare namespace NodeJS {
    interface ProcessEnv {
        REACT_APP_AI_URL: string;
        REACT_APP_BACKEND_URL: string;
        NODE_ENV: 'development' | 'production' | 'test';
    }
}
