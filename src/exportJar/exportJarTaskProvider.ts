import { extname } from "path";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CustomExecution, Event, EventEmitter, Extension, extensions,
    Pseudoterminal, Task, TaskDefinition, TaskProvider, TaskScope,
    TerminalDimensions, Uri, workspace } from "vscode";
import { Jdtls } from "../java/jdtls";
import { INodeData } from "../java/nodeData";
import { ClasspathResult } from "./GenerateJarExecutor";

export class ExportJarTaskProvider implements TaskProvider {

    public static exportJarType: string = "exportjar";

    private tasks: Task[] | undefined;

    public async provideTasks(): Promise<Task[]> {
        return this.getTasks();
    }

    public resolveTask(task: Task): Task | undefined {
        return undefined;
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
            for (const project of projectList) {
                const classPaths: ClasspathResult = await extensionApi.getClasspaths(project.uri, { scope: "runtime" });
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
                    }
                }
                const testClassPaths: ClasspathResult = await extensionApi.getClasspaths(project.uri, { scope: "test" });
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
                    }
                }
            }
            outputList.push("External Dependencies");
            const defaultDefinition: IExportJarTaskDefinition = {
                type: ExportJarTaskProvider.exportJarType,
                files: outputList,
            };
            this.tasks.push(new Task(defaultDefinition, folder, folder.name,
                ExportJarTaskProvider.exportJarType, new CustomExecution(async (): Promise<Pseudoterminal> => {
                    return new ExportJarTaskTerminal();
                })));
        }
        return this.tasks;
    }

}

interface IExportJarTaskDefinition extends TaskDefinition {
    files?: string[];
    manifest?: string;
}

class ExportJarTaskTerminal implements Pseudoterminal {

    public writeEmitter = new EventEmitter<string>();
    public closeEmitter = new EventEmitter<void>();

    public onDidWrite: Event<string> = this.writeEmitter.event;
    public onDidClose?: Event<void> = this.closeEmitter.event;

    public open(initialDimensions: TerminalDimensions | undefined): void {

    }

    public close(): void {

    }

}
