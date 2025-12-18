// Analytics tracking utility
// Currently logs to console, can be replaced with actual analytics service

export const EVENTS = {
    MODE_SWITCH_DEMO: 'mode_switch_demo',
    MODE_SWITCH_BYOK: 'mode_switch_byok',
    CLICK_GENERATE: 'click_generate',
    OPEN_BYOK_KEY_PROMPT: 'open_byok_key_prompt',
    SUBMIT_BYOK_KEY: 'submit_byok_key',
    GENERATION_SUCCESS: 'generation_success',
    GENERATION_ERROR: 'generation_error',
    DEMO_LIMIT_REACHED: 'demo_limit_reached',
} as const;

type EventName = (typeof EVENTS)[keyof typeof EVENTS];

interface AnalyticsProperties {
    mode?: string;
    error_code?: string;
    [key: string]: unknown;
}

export const analytics = {
    track: (event: EventName, properties?: AnalyticsProperties) => {
        // Development logging (always log for now)
        console.log('[Analytics]', event, properties || {});

        // TODO: Replace with actual analytics service (e.g., Google Analytics, Mixpanel)
        // Example for Google Analytics:
        // if (typeof gtag !== 'undefined') {
        //     gtag('event', event, properties);
        // }
    },
};
