// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { pathExists } from "fs-extra";
import { basename, extname, join } from "path";
import { Disposable, Extension, extensions, ProgressLocation, QuickInputButtons, Uri, window, workspace } from "vscode";
import { ExportJarStep, IStepMetadata } from "../exportJarFileCommand";
import { Jdtls } from "../java/jdtls";
import { IExportJarStepExecutor } from "./IExportJarStepExecutor";
import { createPickBox, IJarQuickPickItem, saveDialog } from "./utility";

export class GenerateJarExecutor implements IExportJarStepExecutor {

    public async execute(stepMetadata: IStepMetadata): Promise<ExportJarStep> {
        if (await this.generateJar(stepMetadata)) {
            return ExportJarStep.Finish;
        }
        return ExportJarStep.ResolveMainMethod;
    }

    private async generateJar(stepMetadata: IStepMetadata): Promise<boolean> {
        if (!(await this.generateElements(stepMetadata))) {
            return false;
        }
        return window.withProgress({
            location: ProgressLocation.Window,
            title: "Exporting Jar : Generating jar...",
            cancellable: true,
        }, (progress, token) => {
            return new Promise<boolean>(async (resolve, reject) => {
                token.onCancellationRequested(() => {
                    return reject();
                });
                let destPath: string = "";
                if (workspace.getConfiguration("java.dependency.exportjar").get<boolean>("defaultTargetFolder")) {
                    destPath = join(stepMetadata.workspaceUri.fsPath, basename(stepMetadata.workspaceUri.fsPath) + ".jar");
                } else {
                    const outputUri: Uri = await saveDialog(stepMetadata.workspaceUri, "Generate");
                    if (outputUri === undefined) {
                        return reject();
                    }
                    destPath = outputUri.fsPath;
                }
                const exportResult = await Jdtls.exportJar(basename(stepMetadata.selectedMainMethod), stepMetadata.elements, destPath);
                if (exportResult === true) {
                    stepMetadata.outputPath = destPath;
                    return resolve(true);
                } else {
                    return reject(new Error("Export jar failed."));
                }
            });
        });
    }

    private async generateElements(stepMetadata: IStepMetadata): Promise<boolean> {
        const extension: Extension<any> | undefined = extensions.getExtension("redhat.java");
        const extensionApi: any = await extension?.activate();
        const dependencyItems: IJarQuickPickItem[] = await window.withProgress({
            location: ProgressLocation.Window,
            title: "Exporting Jar : Resolving classpaths...",
            cancellable: true,
        }, (progress, token) => {
            return new Promise<IJarQuickPickItem[]>(async (resolve, reject) => {
                token.onCancellationRequested(() => {
                    return reject();
                });
                const pickItems: IJarQuickPickItem[] = [];
                const uriSet: Set<string> = new Set<string>();
                for (const rootNode of stepMetadata.projectList) {
                    const classPaths: ClasspathResult = await extensionApi.getClasspaths(rootNode.uri, { scope: "runtime" });
                    pickItems.push(...await this.parseDependencyItems(classPaths.classpaths, uriSet, stepMetadata.workspaceUri.fsPath, true),
                        ...await this.parseDependencyItems(classPaths.modulepaths, uriSet, stepMetadata.workspaceUri.fsPath, true));
                    const classPathsTest: ClasspathResult = await extensionApi.getClasspaths(rootNode.uri, { scope: "test" });
                    pickItems.push(...await this.parseDependencyItems(classPathsTest.classpaths, uriSet, stepMetadata.workspaceUri.fsPath, false),
                        ...await this.parseDependencyItems(classPathsTest.modulepaths, uriSet, stepMetadata.workspaceUri.fsPath, false));
                }
                return resolve(pickItems);
            });
        });
        if (dependencyItems.length === 0) {
            throw new Error("No classpath found. Please make sure your project is valid.");
        } else if (dependencyItems.length === 1) {
            stepMetadata.elements.push(dependencyItems[0].uri);
            return true;
        }
        dependencyItems.sort((node1, node2) => {
            if (node1.description !== node2.description) {
                return node1.description.localeCompare(node2.description);
            }
            if (node1.type !== node2.type) {
                return node2.type.localeCompare(node1.type);
            }
            return node1.label.localeCompare(node2.label);
        });
        const pickedDependencyItems: IJarQuickPickItem[] = [];
        for (const item of dependencyItems) {
            if (item.picked) {
                pickedDependencyItems.push(item);
            }
        }
        const disposables: Disposable[] = [];
        let result: boolean = false;
        try {
            result = await new Promise<boolean>(async (resolve, reject) => {
                const pickBox = createPickBox("Export Jar : Determine elements", "Select the elements", dependencyItems,
                    stepMetadata.isPickedWorkspace, true);
                pickBox.selectedItems = pickedDependencyItems;
                disposables.push(
                    pickBox.onDidTriggerButton((item) => {
                        if (item === QuickInputButtons.Back) {
                            return resolve(false);
                        }
                    }),
                    pickBox.onDidAccept(() => {
                        for (const item of pickBox.selectedItems) {
                            stepMetadata.elements.push(item.uri);
                        }
                        return resolve(true);
                    }),
                    pickBox.onDidHide(() => {
                        return reject();
                    }),
                );
                disposables.push(pickBox);
                pickBox.show();
            });
        } finally {
            for (const d of disposables) {
                d.dispose();
            }
        }
        return result;
    }

    private async parseDependencyItems(paths: string[], uriSet: Set<string>, projectPath: string, isRuntime: boolean): Promise<IJarQuickPickItem[]> {
        const dependencyItems: IJarQuickPickItem[] = [];
        for (const classpath of paths) {
            if (await pathExists(classpath) === false) {
                continue;
            }
            const extName = extname(classpath);
            const baseName = Uri.parse(classpath).fsPath.startsWith(Uri.parse(projectPath).fsPath) ?
                classpath.substring(projectPath.length + 1) : basename(classpath);
            const descriptionValue = (isRuntime) ? "Runtime" : "Test";
            const typeValue = (extName === ".jar") ? "external" : "internal";
            if (!uriSet.has(classpath)) {
                uriSet.add(classpath);
                dependencyItems.push({
                    label: baseName,
                    description: descriptionValue,
                    uri: classpath,
                    type: typeValue,
                    picked: isRuntime,
                });
            }
        }
        return dependencyItems;
    }

}

export class ClasspathResult {
    public projectRoot: string;
    public classpaths: string[];
    public modulepaths: string[];
}
