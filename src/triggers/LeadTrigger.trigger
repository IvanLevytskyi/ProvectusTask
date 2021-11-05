/**
 * @description Apex trigger on the Lead Sobject
 */
trigger LeadTrigger on Lead (after insert) {
    switch on Trigger.operationType {
        when AFTER_INSERT {
            // Call method to publish events
            EventBus.publish(new List<levtrail__NewLeadCreated__e> { new levtrail__NewLeadCreated__e ()});
        }
    }
}