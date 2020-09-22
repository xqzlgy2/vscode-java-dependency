// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { extname } from "path";
import {
    CustomExecution, Event, EventEmitter, Extension, extensions,
    Pseudoterminal, Task, TaskDefinition, TaskProvider, TaskScope,
    TerminalDimensions, Uri, workspace,
} from "vscode";
import { buildWorkspace } from "../build";
import { createJarFile, ExportJarStep } from "../exportJarFileCommand";
import { isStandardServerReady } from "../extension";
import { Jdtls } from "../java/jdtls";
import { INodeData } from "../java/nodeData";
import { IClasspathResult } from "./GenerateJarExecutor";
import { IStepMetadata } from "./IStepMetadata";

export class ExportJarTaskProvider implements TaskProvider {

    public static exportJarType: string = "exportjar";

    public static getDefaultTask(): Task {
        return ExportJarTaskProvider.defaultTask;
    }

    public static setDefaultTaskEntry(node?: INodeData): void {
        if (ExportJarTaskProvider.defaultTask.definition instanceof ExportJarTaskDefinition) {
            ExportJarTaskProvider.defaultTask.definition.entry = node;
        }
    }

    private static defaultTask: Task = ExportJarTaskProvider.initDefaultTask();

    private static initDefaultTask(): Task {
        const defaultDefinition: ExportJarTaskDefinition = {
            type: ExportJarTaskProvider.exportJarType,
            elements: [],
            steps: [],
        };
        return new Task(defaultDefinition, TaskScope.Workspace, "export", ExportJarTaskProvider.exportJarType,
            new CustomExecution(async (): Promise<Pseudoterminal> => {
                return new ExportJarTaskTerminal(defaultDefinition);
            }));
    }

    private tasks: Task[] | undefined;

    public async provideTasks(): Promise<Task[]> {
        return this.getTasks();
    }

    public resolveTask(task: Task): Task | undefined {
        const definition: ExportJarTaskDefinition = <any>task.definition;
        return this.getTask(definition.workspacePath, definition.workSpace, definition.elements,
            definition.projectList, definition.manifest, definition);
    }

    private async getTasks(): Promise<Task[]> {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        this.tasks = [];
        // multi workspace
        const folders = workspace.workspaceFolders;
        if (folders.length === 0) {
            return this.tasks;
        }
        const extension: Extension<any> | undefined = extensions.getExtension("redhat.java");
        const extensionApi: any = await extension?.activate();
        for (const folder of folders) {
            const folderStr: string = Uri.parse(folder.uri.toString()).toString();
            const projectPath: string = Uri.parse(folder.uri.toString()).fsPath;
            const projectList: INodeData[] = await Jdtls.getProjects(folderStr);
            const uriSet: Set<string> = new Set<string>();
            const outputList: string[] = [];
            let runtime: boolean = false;
            let test: boolean = false;
            for (const project of projectList) {
                const classPaths: IClasspathResult = await extensionApi.getClasspaths(project.uri, { scope: "runtime" });
                for (let classpath of classPaths.classpaths) {
                    const extName = extname(classpath);
                    if (extName !== ".jar") {
                        if (!uriSet.has(classpath)) {
                            uriSet.add(classpath);
                            if (Uri.parse(classpath).fsPath.startsWith(Uri.parse(projectPath).fsPath)) {
                                classpath = classpath.substring(projectPath.length + 1);
                            }
                            outputList.push(classpath);
                        }
                    } else {
                        runtime = true;
                    }
                }
                const testClassPaths: IClasspathResult = await extensionApi.getClasspaths(project.uri, { scope: "test" });
                for (let classpath of testClassPaths.classpaths) {
                    const extName = extname(classpath);
                    if (extName !== ".jar") {
                        if (!uriSet.has(classpath)) {
                            uriSet.add(classpath);
                            if (Uri.parse(classpath).fsPath.startsWith(Uri.parse(projectPath).fsPath)) {
                                classpath = classpath.substring(projectPath.length + 1);
                            }
                            outputList.push(classpath);
                        }
                    } else {
                        test = true;
                    }
                }
            }
            if (runtime) {
                outputList.push("Runtime Dependencies");
            }
            if (test) {
                outputList.push("Test Dependencies");
            }
            const defaultDefinition: ExportJarTaskDefinition = {
                type: ExportJarTaskProvider.exportJarType,
                elements: outputList,
                workspacePath: folder.uri.fsPath,
            };
            this.tasks.push(new Task(defaultDefinition, folder, folder.name,
                ExportJarTaskProvider.exportJarType, new CustomExecution(async (): Promise<Pseudoterminal> => {
                    return new ExportJarTaskTerminal(defaultDefinition);
                })));
        }
        return this.tasks;
    }

    private getTask(workspacePath: string, workSpace: Uri, elements: string[], projectList: INodeData[],
        manifest: string, definition?: ExportJarTaskDefinition): Task {
        if (definition === undefined) {
            definition = {
                type: ExportJarTaskProvider.exportJarType,
                workspacePath,
                workSpace,
                elements,
                projectList,
                manifest,
            };
        }
        return new Task(definition, TaskScope.Workspace, workspacePath,
            ExportJarTaskProvider.exportJarType, new CustomExecution(async (): Promise<Pseudoterminal> => {
                return new ExportJarTaskTerminal(definition);
            }));
    }

}

class ExportJarTaskDefinition implements TaskDefinition {
    [name: string]: any;
    public type: string;
    public entry?: INodeData;
    public workSpace?: Uri;
    public elements?: string[];
    public projectList?: INodeData[];
    public selectedMainMethod?: string;
    public manifest?: string;
    public outputPath?: string;
    public steps?: ExportJarStep[];
}

class ExportJarTaskTerminal implements Pseudoterminal {

    public writeEmitter = new EventEmitter<string>();
    public closeEmitter = new EventEmitter<void>();

    public onDidWrite: Event<string> = this.writeEmitter.event;
    public onDidClose?: Event<void> = this.closeEmitter.event;

    private exportJarTaskDefinition: ExportJarTaskDefinition;

    constructor(exportJarTaskDefinition: ExportJarTaskDefinition) {
        this.exportJarTaskDefinition = exportJarTaskDefinition;
    }

    public async open(initialDimensions: TerminalDimensions | undefined): Promise<void> {
        const stepMetadata: IStepMetadata = {
            entry: this.exportJarTaskDefinition.entry,
            workspaceUri: this.exportJarTaskDefinition.workSpace,
            elements: this.exportJarTaskDefinition.elements,
            projectList: this.exportJarTaskDefinition.projectList,
            manifestPath: this.exportJarTaskDefinition.manifest,
            steps: this.exportJarTaskDefinition.steps,
            outputPath: this.exportJarTaskDefinition.outputPath,
        };
        createJarFile(stepMetadata);
    }

    public close(): void {
    }

}
