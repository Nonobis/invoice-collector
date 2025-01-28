import { ScrapperCollector } from '../base_collector';
import { AmazonSelectors } from './selectors';

export class FreeCollector extends ScrapperCollector {

    static CONFIG = {
        name: "Amazon",
        description: "i18n.collectors.amazon.description",
        version: "1",
        website: "https://www.amazon.fr",
        logo: "https://cdn.iconscout.com/icon/free/png-256/free-amazon-43-432492.png",
        params: {
            username: {
                type: "string",
                name: "i18n.collectors.all.identifier",
                placeholder: "i18n.collectors.amazon.identifier.placeholder",
                mandatory: true
            },
            password: {
                type: "string",
                name: "i18n.collectors.all.password",
                placeholder: "i18n.collectors.all.password.placeholder",
                mandatory: true,
            },
            /*marketplace: {
                type: "enum",
                name: "i18n.collectors.all.password",
                placeholder: "i18n.collectors.all.password.placeholder",
                mandatory: true,
                enum : {
                    fr: "France",
                    com: "United-States",
                    ca: "Canada",
                    "com.mx": "Mexico",
                    "co.uk": "United-Kingdom",
                    de: "Germany",
                    it: "Italy",
                    es: "Spain",
                    nl: "Netherlands",
                    in: "India",
                    jp: "Japan",
                    "com.tr": "Turkey",
                    sa: "Saudi-Arabia",
                    ae: "United-Arab-Emirates",
                    au: "Australia",
                    sg: "Singapore",
                    "com.br": "Brazil"
                }
            }*/
        },
        entry_url: "https://www.amazon.fr/gp/css/order-history"
    }

    constructor() {
        super(FreeCollector.CONFIG);
    }

    async login(driver, params){

        // Input username
        await driver.input_text(AmazonSelectors.FIELD_USERNAME, params.username);
        await driver.left_click(AmazonSelectors.BUTTON_CONTINUE);

        // Check if username is incorrect
        const username_alert = await driver.wait_for_element(AmazonSelectors.CONTAINER_LOGIN_ALERT, false, 2000);
        if (username_alert) {
            return await username_alert.evaluate(e => e.textContent);
        }

        // Input password
        await driver.input_text(AmazonSelectors.FIELD_PASSWORD, params.password);
        await driver.left_click(AmazonSelectors.BUTTON_SUBMIT);

        // Check if password is incorrect
        const password_alert = await driver.wait_for_element(AmazonSelectors.CONTAINER_CAPTCHA, false, 2000);
        if (password_alert) {
            return "i18n.collectors.all.password.error";
        }
    }

    async run(driver, params) {
        // Go to order history
        await driver.page.goto("https://www.amazon.fr/gp/css/order-history");

        // Get all order ids
        const order_ids = await driver.get_all_attributes(AmazonSelectors.CONTAINER_ORDERID, "textContent", false, 5000);
        
        // Return invoices
        let invoices: any[] = [];
        for (const order_id of order_ids) {
            const link = `https://www.amazon.fr/gp/css/summary/print.html/?ie=UTF8&orderID=${order_id}`;

            // Get date
            const timestamp = "TODO";

            // Get amount
            const amount = "TODO";

            invoices.push({
                id: order_id,
                type: "webpage",
                timestamp: timestamp || null,
                mime: 'application/pdf',
                amount: amount,
                link: link
            });
        }
        return invoices;
    }
}
