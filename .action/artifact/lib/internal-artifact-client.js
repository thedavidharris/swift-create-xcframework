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
const core = __importStar(require("../../core"));
const internal_upload_specification_1 = require("./internal-upload-specification");
const internal_upload_http_client_1 = require("./internal-upload-http-client");
const internal_utils_1 = require("./internal-utils");
const internal_download_http_client_1 = require("./internal-download-http-client");
const internal_download_specification_1 = require("./internal-download-specification");
const internal_config_variables_1 = require("./internal-config-variables");
const path_1 = require("path");
class DefaultArtifactClient {
    /**
     * Constructs a DefaultArtifactClient
     */
    static create() {
        return new DefaultArtifactClient();
    }
    /**
     * Uploads an artifact
     */
    uploadArtifact(name, files, rootDirectory, options) {
        return __awaiter(this, void 0, void 0, function* () {
            internal_utils_1.checkArtifactName(name);
            // Get specification for the files being uploaded
            const uploadSpecification = internal_upload_specification_1.getUploadSpecification(name, rootDirectory, files);
            const uploadResponse = {
                artifactName: name,
                artifactItems: [],
                size: 0,
                failedItems: []
            };
            if (uploadSpecification.length === 0) {
                core.warning(`No files found that can be uploaded`);
            }
            else {
                // Create an entry for the artifact in the file container
                const response = yield internal_upload_http_client_1.createArtifactInFileContainer(name);
                if (!response.fileContainerResourceUrl) {
                    core.debug(response.toString());
                    throw new Error('No URL provided by the Artifact Service to upload an artifact to');
                }
                core.debug(`Upload Resource URL: ${response.fileContainerResourceUrl}`);
                // Upload each of the files that were found concurrently
                const uploadResult = yield internal_upload_http_client_1.uploadArtifactToFileContainer(response.fileContainerResourceUrl, uploadSpecification, options);
                //Update the size of the artifact to indicate we are done uploading
                yield internal_upload_http_client_1.patchArtifactSize(uploadResult.size, name);
                core.info(`Finished uploading artifact ${name}. Reported size is ${uploadResult.size} bytes. There were ${uploadResult.failedItems.length} items that failed to upload`);
                uploadResponse.artifactItems = uploadSpecification.map(item => item.absoluteFilePath);
                uploadResponse.size = uploadResult.size;
                uploadResponse.failedItems = uploadResult.failedItems;
            }
            return uploadResponse;
        });
    }
    downloadArtifact(name, path, options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const artifacts = yield internal_download_http_client_1.listArtifacts();
            if (artifacts.count === 0) {
                throw new Error(`Unable to find any artifacts for the associated workflow`);
            }
            const artifactToDownload = artifacts.value.find(artifact => {
                return artifact.name === name;
            });
            if (!artifactToDownload) {
                throw new Error(`Unable to find an artifact with the name: ${name}`);
            }
            const items = yield internal_download_http_client_1.getContainerItems(artifactToDownload.name, artifactToDownload.fileContainerResourceUrl);
            if (!path) {
                path = internal_config_variables_1.getWorkSpaceDirectory();
            }
            path = path_1.normalize(path);
            path = path_1.resolve(path);
            // During upload, empty directories are rejected by the remote server so there should be no artifacts that consist of only empty directories
            const downloadSpecification = internal_download_specification_1.getDownloadSpecification(name, items.value, path, ((_a = options) === null || _a === void 0 ? void 0 : _a.createArtifactFolder) || false);
            if (downloadSpecification.filesToDownload.length === 0) {
                core.info(`No downloadable files were found for the artifact: ${artifactToDownload.name}`);
            }
            else {
                // Create all necessary directories recursively before starting any download
                yield internal_utils_1.createDirectoriesForArtifact(downloadSpecification.directoryStructure);
                yield internal_download_http_client_1.downloadSingleArtifact(downloadSpecification.filesToDownload);
            }
            return {
                artifactName: name,
                downloadPath: downloadSpecification.rootDownloadLocation
            };
        });
    }
    downloadAllArtifacts(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = [];
            const artifacts = yield internal_download_http_client_1.listArtifacts();
            if (artifacts.count === 0) {
                core.info('Unable to find any artifacts for the associated workflow');
                return response;
            }
            if (!path) {
                path = internal_config_variables_1.getWorkSpaceDirectory();
            }
            path = path_1.normalize(path);
            path = path_1.resolve(path);
            const ARTIFACT_CONCURRENCY = internal_config_variables_1.getDownloadArtifactConcurrency();
            const parallelDownloads = [...new Array(ARTIFACT_CONCURRENCY).keys()];
            let downloadedArtifacts = 0;
            yield Promise.all(parallelDownloads.map(() => __awaiter(this, void 0, void 0, function* () {
                while (downloadedArtifacts < artifacts.count) {
                    const currentArtifactToDownload = artifacts.value[downloadedArtifacts];
                    downloadedArtifacts += 1;
                    // Get container entries for the specific artifact
                    const items = yield internal_download_http_client_1.getContainerItems(currentArtifactToDownload.name, currentArtifactToDownload.fileContainerResourceUrl);
                    // Promise.All is not correctly inferring that 'path' is no longer possibly undefined: https://github.com/microsoft/TypeScript/issues/34925
                    const downloadSpecification = internal_download_specification_1.getDownloadSpecification(currentArtifactToDownload.name, items.value, path, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                    true);
                    if (downloadSpecification.filesToDownload.length === 0) {
                        core.info(`No downloadable files were found for any artifact ${currentArtifactToDownload.name}`);
                    }
                    else {
                        yield internal_utils_1.createDirectoriesForArtifact(downloadSpecification.directoryStructure);
                        yield internal_download_http_client_1.downloadSingleArtifact(downloadSpecification.filesToDownload);
                    }
                    response.push({
                        artifactName: currentArtifactToDownload.name,
                        downloadPath: downloadSpecification.rootDownloadLocation
                    });
                }
            })));
            return response;
        });
    }
}
exports.DefaultArtifactClient = DefaultArtifactClient;
//# sourceMappingURL=internal-artifact-client.js.map