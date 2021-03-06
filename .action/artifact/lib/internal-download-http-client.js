"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const internal_utils_1 = require("./internal-utils");
const url_1 = require("url");
const internal_config_variables_1 = require("./internal-config-variables");
const core_1 = require("../../core");
/**
 * Gets a list of all artifacts that are in a specific container
 */
function listArtifacts() {
    return __awaiter(this, void 0, void 0, function* () {
        const artifactUrl = internal_utils_1.getArtifactUrl();
        const client = internal_utils_1.createHttpClient();
        const requestOptions = internal_utils_1.getRequestOptions('application/json');
        const rawResponse = yield client.get(artifactUrl, requestOptions);
        const body = yield rawResponse.readBody();
        if (internal_utils_1.isSuccessStatusCode(rawResponse.message.statusCode) && body) {
            return JSON.parse(body);
        }
        // eslint-disable-next-line no-console
        console.log(rawResponse);
        throw new Error(`Unable to list artifacts for the run`);
    });
}
exports.listArtifacts = listArtifacts;
/**
 * Fetches a set of container items that describe the contents of an artifact
 * @param artifactName the name of the artifact
 * @param containerUrl the artifact container URL for the run
 */
function getContainerItems(artifactName, containerUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        // The itemPath search parameter controls which containers will be returned
        const resourceUrl = new url_1.URL(containerUrl);
        resourceUrl.searchParams.append('itemPath', artifactName);
        const client = internal_utils_1.createHttpClient();
        const rawResponse = yield client.get(resourceUrl.toString());
        const body = yield rawResponse.readBody();
        if (internal_utils_1.isSuccessStatusCode(rawResponse.message.statusCode) && body) {
            return JSON.parse(body);
        }
        // eslint-disable-next-line no-console
        console.log(rawResponse);
        throw new Error(`Unable to get ContainersItems from ${resourceUrl}`);
    });
}
exports.getContainerItems = getContainerItems;
/**
 * Concurrently downloads all the files that are part of an artifact
 * @param downloadItems information about what items to download and where to save them
 */
function downloadSingleArtifact(downloadItems) {
    return __awaiter(this, void 0, void 0, function* () {
        const DOWNLOAD_CONCURRENCY = internal_config_variables_1.getDownloadFileConcurrency();
        // Limit the number of files downloaded at a single time
        const parallelDownloads = [...new Array(DOWNLOAD_CONCURRENCY).keys()];
        const client = internal_utils_1.createHttpClient();
        let downloadedFiles = 0;
        yield Promise.all(parallelDownloads.map(() => __awaiter(this, void 0, void 0, function* () {
            while (downloadedFiles < downloadItems.length) {
                const currentFileToDownload = downloadItems[downloadedFiles];
                downloadedFiles += 1;
                yield downloadIndividualFile(client, currentFileToDownload.sourceLocation, currentFileToDownload.targetPath);
            }
        })));
    });
}
exports.downloadSingleArtifact = downloadSingleArtifact;
/**
 * Downloads an individual file
 * @param client http client that will be used to make the necessary calls
 * @param artifactLocation origin location where a file will be downloaded from
 * @param downloadPath destination location for the file being downloaded
 */
function downloadIndividualFile(client, artifactLocation, downloadPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const stream = fs.createWriteStream(downloadPath);
        const response = yield client.get(artifactLocation);
        if (internal_utils_1.isSuccessStatusCode(response.message.statusCode)) {
            yield pipeResponseToStream(response, stream);
        }
        else if (internal_utils_1.isRetryableStatusCode(response.message.statusCode)) {
            core_1.warning(`Received http ${response.message.statusCode} during file download, will retry ${artifactLocation} after 10 seconds`);
            yield new Promise(resolve => setTimeout(resolve, 10000));
            const retryResponse = yield client.get(artifactLocation);
            if (internal_utils_1.isSuccessStatusCode(retryResponse.message.statusCode)) {
                yield pipeResponseToStream(response, stream);
            }
            else {
                // eslint-disable-next-line no-console
                console.log(retryResponse);
                throw new Error(`Unable to download ${artifactLocation}`);
            }
        }
        else {
            // eslint-disable-next-line no-console
            console.log(response);
            throw new Error(`Unable to download ${artifactLocation}`);
        }
    });
}
exports.downloadIndividualFile = downloadIndividualFile;
function pipeResponseToStream(response, stream) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            response.message.pipe(stream).on('close', () => {
                resolve();
            });
        });
    });
}
exports.pipeResponseToStream = pipeResponseToStream;
//# sourceMappingURL=internal-download-http-client.js.map