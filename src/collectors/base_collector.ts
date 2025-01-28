import axios from 'axios';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { Driver } from '../driver';
import { NotAuthenticatedError, InMaintenanceError, UnfinishedCollector } from '../error';

export class AbstractCollector {
    config: any;

    constructor(config) {
        this.config = config;
    }

    async download(invoices): Promise<void> {
        for(let invoice of invoices) {
            if(invoice.type == "link") {
                const response = await axios.get(invoice.link, {
                    responseType: 'arraybuffer',
                });
                invoice.data = response.data.toString("base64");
                invoice.type = "base64";
            }
            else if(invoice.type == "bytes") {
                invoice.data = btoa(String.fromCharCode.apply(null, invoice.bytes));
                delete invoice.bytes;
                invoice.type = "base64";
            }
        }

        // Order invoices by timestamp
        invoices.sort((a, b) => a.timestamp - b.timestamp);
    }

    async collect_new_invoices(params, download, previousInvoices): Promise<any[]> {
        const invoices = await this.collect(params, download);

        // Get new invoices
        const newInvoices = invoices.filter((inv) => !previousInvoices.includes(inv.id));

        if(newInvoices.length > 0) {
            console.log(`Found ${invoices.length} invoices but only ${newInvoices.length} are new`);

            // Download new invoices if needed
            if(download) {
                console.log(`Downloading ${newInvoices.length} invoices`);
                await this.download(newInvoices);
            }
            else {
                console.log(`This is the first collect. Do not download invoices`);
            }
        }
        else {
            console.log(`Found ${invoices.length} invoices but none are new`);
        }

        return newInvoices;
    }

    //NOT IMPLEMENTED

    async collect(params, download=true): Promise<any[]> {
        throw new Error('`collect` is not implemented.');
    }
}

export class ScrapperCollector extends AbstractCollector {
    
    PUPPETEER_CONFIG: LaunchOptions = {
        headless: true,
        args:[
            '--start-maximized', // you can also use '--start-fullscreen'
            '--no-sandbox',
        ]
    };

    PAGE_CONFIG = {
        width: 1920,
        height: 1080,
    };

    authentication_error: string | null;

    constructor(config) {
        super(config);
        this.authentication_error = null;
    }

    async collect(params, download=true): Promise<any[]> {
        if(!params.username) {
            throw new Error('Field "username" is missing.');
        }
        if(!params.password) {
            throw new Error('Field "password" is missing.');
        }

        // Start browser
        let browser = await puppeteer.launch(this.PUPPETEER_CONFIG);

        // Open new page
        let page = await browser.newPage();
        await page.setViewport(this.PAGE_CONFIG);
        await page.goto(this.config.entry_url);

        let driver = new Driver(page, this);

        // Check if website is in maintenance
        const is_in_maintenance = await this.is_in_maintenance(driver, params)
        if (is_in_maintenance) {
            await browser.close()
            throw new InMaintenanceError(this.config.name, this.config.version);
        }

        // Login
        await this.login(driver, params)

        // Check if not authenticated
        const authentication_error = await this.get_authentication_error(driver, params)
        if (authentication_error) {
            await browser.close()
            throw new NotAuthenticatedError(authentication_error, this.config.name, this.config.version);
        }

        // Collect invoices
        const invoices = await this.run(driver, params)
        if (invoices === undefined) {
            const url = await page.url();
            const source_code = await page.content();
            const source_code_base64 = Buffer.from(source_code).toString('base64')
            const screenshot = await page.screenshot({encoding: 'base64'});
            await browser.close()
            throw new UnfinishedCollector(this.config.name, this.config.version, url, source_code_base64, screenshot);
        }

        // Close the borwser
        await browser.close()

        return invoices;
    }

    //NOT IMPLEMENTED

    async login(driver, params): Promise<void>{
        throw new Error('`login` is not implemented.');
    }

    async run(driver, params): Promise<any[]> {
        throw new Error('`run` is not implemented.');
    }

    async get_authentication_error(driver, params): Promise<string | null> {
        return this.authentication_error;
    }

    async is_in_maintenance(driver, params): Promise<boolean>{
        //Assume the website is not in maintenance
        return false;
    }
}

export class ApiCollector extends AbstractCollector {
    constructor(config) {
        super(config);
    }
}
