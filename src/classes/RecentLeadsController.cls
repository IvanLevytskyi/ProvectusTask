/**
 * @description Apex Controller for the LWC component called recentLeads
 */
public with sharing class RecentLeadsController {
    // Class for the combobox
    public class SelectOption {
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String value;

        public SelectOption(String labelA, String valueA) {
            label = labelA;
            value = valueA;
        }
    }

    /**
     * @description Apex method for retrieving recent leads
     * @param filter - String value that represents Lead Status field. In case filter is blank - query any leads
     *
     * @return list of the 20 most recent leads that match filter criteria
     */
    @AuraEnabled(cacheable=true)
    public static List<Lead> getRecentLeads(String filter) {
        // Escape single quotes in order to avoid SOQL injection
        filter = String.escapeSingleQuotes(filter);

        // String for dynamic SOQL query
        String query = 'SELECT Id, Name, Status, levtrail__TimeZone__c, levtrail__Flagged__c '
                + 'FROM Lead WHERE IsConverted = FALSE'
                + (String.isNotBlank(filter) ? ' AND Status = \'' + filter + '\' ' : ' ')
                + ' ORDER BY CreatedDate DESC LIMIT 20';

        return Database.query(query);
    }

    /**
     * @description Describe Lead.Status field
     * @return List<SelectOption> with labels and values of the appropriate picklist options
     */
    @AuraEnabled
    public static List<SelectOption> getStatusOption() {
        List<SelectOption> result = new List<SelectOption>();

        for (Schema.PicklistEntry pickListItem : Lead.Status.getDescribe().getPicklistValues()) {
            result.add(new SelectOption(pickListItem.label, pickListItem.value));
        }

        return result;
    }
}