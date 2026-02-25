import { patchFetch } from "@/interceptor/fetch-patch";
import { initRuleCache } from "@/interceptor/rule-cache";
import { patchXmlHttpRequest } from "@/interceptor/xhr-patch";

initRuleCache();
patchFetch();
patchXmlHttpRequest();
