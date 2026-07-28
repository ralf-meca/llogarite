export type RevenueCatWebhookEvent = {
    type: string;
    app_user_id: string;
};

export type RevenueCatWebhookPayload = {
    event: RevenueCatWebhookEvent;
};
