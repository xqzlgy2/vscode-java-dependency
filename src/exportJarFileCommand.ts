import { commands } from "vscode";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { buildWorkspace } from "./build";
import { GenerateJarExecutor } from "./exportJarSteps/GenerateJarExecutor";
import { IExportJarStepExecutor } from "./exportJarSteps/IExportJarStepExecutor";
import { IStepMetadata } from "./exportJarSteps/IStepMetadata";
import { ResolveJavaProjectExecutor } from "./exportJarSteps/ResolveJavaProjectExecutor";
import { ResolveMainMethodExecutor } from "./exportJarSteps/ResolveMainMethodExecutor";
import { ErrorWithHandler, failMessage, successMessage } from "./exportJarSteps/utility";
import { isStandardServerReady } from "./extension";
import { INodeData } from "./java/nodeData";

export enum ExportJarStep {
    ResolveJavaProject = "RESOLVEJAVAPROJECT",
    ResolveMainMethod = "RESOLVEMAINMETHOD",
    GenerateJar = "GENERATEJAR",
    Finish = "FINISH",
}

const stepMap: Map<ExportJarStep, IExportJarStepExecutor> = new Map<ExportJarStep, IExportJarStepExecutor>([
    [ExportJarStep.ResolveJavaProject, new ResolveJavaProjectExecutor()],
    [ExportJarStep.ResolveMainMethod, new ResolveMainMethodExecutor()],
    [ExportJarStep.GenerateJar, new GenerateJarExecutor()],
]);

let isExportingJar: boolean = false;

export async function createJarFile(node?: INodeData) {
    if (!isStandardServerReady() || isExportingJar) {
        return;
    }
    isExportingJar = true;
    let step: ExportJarStep = ExportJarStep.ResolveJavaProject;
    let stepMetadata: IStepMetadata = {
        entry: node,
        elements: [],
        steps: [],
    };
    return new Promise<string>(async (resolve, reject) => {
        if (await buildWorkspace() === false) {
            isExportingJar = false;
            return reject();
        }
        while (step !== ExportJarStep.Finish) {
            try {
                const executor: IExportJarStepExecutor = stepMap.get(step);
                if (executor === undefined) {
                    // Unpredictable error, return to the initialization
                    step = ExportJarStep.ResolveJavaProject;
                    stepMetadata = {
                        entry: node,
                        elements: [],
                        steps: [],
                    };
                } else {
                    step = await executor.execute(stepMetadata);
                }
            } catch (err) {
                return reject(err);
            }
        }
        return resolve(stepMetadata.outputPath);
    }).then((message) => {
        successMessage(message);
        isExportingJar = false;
    }, (err) => {
        if (err instanceof ErrorWithHandler) {
            failMessage(err.message, err.handler);
        } else if (err) {
            failMessage(`${err}`);
        }
        isExportingJar = false;
    });
}
