import {LightningElement, track, api, wire} from 'lwc';
import getRecentLeads from '@salesforce/apex/RecentLeadsController.getRecentLeads';
import getStatusOption from '@salesforce/apex/RecentLeadsController.getStatusOption';
import ICONS from '@salesforce/resourceUrl/icons';
import {NavigationMixin} from 'lightning/navigation';
import {reduceErrors, showToast} from 'c/lwcUtil';
import {
    subscribe,
    unsubscribe,
    onError,
    setDebugFlag,
    isEmpEnabled,
} from 'lightning/empApi';

// different time intervals and the appropriate name for this time period
const TIME_PERIODS = [
    {start: 0, end: 5, periodName: 'night'},
    {start: 6, end: 9, periodName: 'sunrise'},
    {start: 10, end: 18, periodName: 'day'},
    {start: 19, end: 21, periodName: 'sunset'},
    {start: 22, end: 23, periodName: 'night'}
];

// map where keys are time period names and values are appropriate name of png icons
const TIME_ICONS = new Map([
    ['night', 'moon.png'],
    ['sunrise', 'sunset.png'],
    ['day', 'sun.png'],
    ['sunset', 'sunset.png']
]);

// question mark icon for unknown time periods (for leads where TimeZone field is blank)
const UNKNOWN_TIME_ICON = 'questionMark.png';

// Value for 'Show All' filter
const FILTER_SHOW_ALL = '';

export default class RecentLeads extends NavigationMixin(LightningElement) {
    // Platform Event Channel name
    channelName = '/event/levtrail__NewLeadCreated__e';
    // Current Record Id
    @api
    recordId;
    // List of recent leads
    @track
    recentLeads = [];
    // List of filter options (Lead Status field)
    statusOptions = [];
    // Show/hide spinner
    showSpinner = true;
    // Selected filter value
    selectedFilter = FILTER_SHOW_ALL;
    // The path to flag icon in the static resource
    flagIcon = ICONS + '/flag.png';

    // wire for apex method that retrieve recent leads
    // it executes automatically every time this.$selectedFilter changes
    @wire(getRecentLeads, { filter : '$selectedFilter'})
    wiredLeads({error, data}) {
        if (data) {
            this.recentLeads = this.processLeads(data);
        } else if (error) {
            this.handleError(error);
        }
        this.showSpinner = false;
    }

    // component initialization
    connectedCallback() {
        // retrieve Lead Status options
        getStatusOption()
            .then(result => {
                // Add first default option
                let options = [...result];
                options.unshift({
                   label : 'Show All',
                   value : FILTER_SHOW_ALL
                });

                this.statusOptions = options;
            })
            .catch(error => {
                this.handleError(error);
            })
            .finally(() => {
                this.showSpinner = false;
            });

        // Subscribe to the Platform event
        // Callback invoked whenever a new event message is received - retrieve new leads
        const messageCallback = function (response) {
            console.log('New message received: ', JSON.stringify(response));
            // Response contains the payload of the new message received

            // show spinner
            this.showSpinner = true;

            getRecentLeads({filter : this.selectedFilter})
                .then(result => {
                    this.recentLeads = this.processLeads(result);
                })
                .catch(error => {
                    this.handleError(error);
                })
                .finally(() => {
                    // hide spinner
                    this.showSpinner = false;
                });
        }.bind(this);

        // Invoke subscribe method of empApi. Pass reference to messageCallback
        subscribe(this.channelName, -1, messageCallback).then((response) => {
            // Response contains the subscription information on subscribe call
            console.log(
                'Subscription request sent to: ',
                JSON.stringify(response.channel)
            );
        });
    }

    // convert a proxy object to an object
    proxyToObject(srcProxy) {
        return JSON.parse(JSON.stringify(srcProxy));
    }

    // Process Leads
    // Add new fields
    // -- timeIcon - the path for appropriate icon that represents local time for specified lead record
    // -- styleClass - the main purpose is to identify the opened lead record for appending a special background style
    processLeads(leads) {
        let newLeadList = this.proxyToObject(leads);

        for (let lead of newLeadList) {
            lead.timeIcon = ICONS + '/' + this.getIconNameForTime(this.getLeadLocalHour(lead.levtrail__TimeZone__c));
            lead.styleClass = lead.Id === this.recordId ? 'currentLead liItem' : 'liItem';
        }

        return newLeadList;
    }

    // get iconName based on local time
    getIconNameForTime(hour) {
        if (!hour) {
            return UNKNOWN_TIME_ICON;
        }

        // find time period and appropriate icon for it
        const timePeriod = TIME_PERIODS.find(element => element.start <= hour && element.end >= hour);

        return TIME_ICONS.has(timePeriod.periodName) ? TIME_ICONS.get(timePeriod.periodName) : UNKNOWN_TIME_ICON;
    }

    // Convert hours to Ms
    hourToMs(hour) {
        return hour * 60 * 1000 * 60;
    }

    // Convert minutes to Ms
    minToMs(min) {
        return min * 60 * 1000;
    }

    // Get lead local time based on the current time and lead time zone
    getLeadLocalHour(offset) {
        if (!offset) {
            return null;
        }

        // Date.now() + the current timezone in milliseconds - the desired offset in milliseconds
        return (new Date(Date.now()
                + this.minToMs((new Date()).getTimezoneOffset())
                - this.hourToMs(offset * -1))
        ).getHours();
    }

    // Navigate to the selected (clicked) lead record
    onLeadClick(event) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: event.currentTarget.dataset.id,
                objectApiName: 'Lead',
                actionName: 'view'
            }
        });
    }

    // handle combobox filter change
    onFilterChange(event) {
        this.selectedFilter = event.detail.value;
    }

    // generic error handler
    handleError(error) {
        console.error(error);
        showToast(this, 'error', reduceErrors(error));
    }
}