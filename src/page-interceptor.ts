import { patchFetch } from "@/interceptor/fetch-patch";
import { patchXmlHttpRequest } from "@/interceptor/xhr-patch";

patchFetch();
patchXmlHttpRequest();
