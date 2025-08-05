/**
 * API操作错误类型
 */
export enum ApiErrorType {
    NETWORK_ERROR = "network_error",
    AUTHENTICATION_ERROR = "auth_error",
    RATE_LIMIT_ERROR = "rate_limit_error",
    CONFIGURATION_ERROR = "config_error",
    PARAMETER_ERROR = "param_error",
    UNKNOWN_ERROR = "unknown_error",
}

/**
 * API操作错误类
 */
export class ApiError extends Error {
    constructor(
        public type: ApiErrorType,
        message: string,
        public apiId: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "ApiError";
    }

    /**
     * 获取用户友好的错误消息
     */
    getUserMessage(): string {
        switch (this.type) {
            case ApiErrorType.NETWORK_ERROR:
                return `Network error when connecting to API. Please check your internet connection.`;
            case ApiErrorType.AUTHENTICATION_ERROR:
                return `Authentication failed. Please check your API credentials.`;
            case ApiErrorType.RATE_LIMIT_ERROR:
                return `Rate limit exceeded. Please try again later.`;
            case ApiErrorType.CONFIGURATION_ERROR:
                return `API configuration error. Please check your settings.`;
            default:
                return `An unexpected error occurred: ${this.message}`;
        }
    }
}
