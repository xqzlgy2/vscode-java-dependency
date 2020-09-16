// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { CustomExecution, Event, EventEmitter, Pseudoterminal, Task, TaskDefinition, TaskProvider, TaskScope, TerminalDimensions } from "vscode";

export class ExportJarTaskProvider implements TaskProvider {

    public static exportJarType: string = "exportjar";

    private tasks: Task[] | undefined;

    public async provideTasks(): Promise<Task[]> {
        return this.getTasks();
    }

    public resolveTask(task: Task): Task | undefined {
        return undefined;
    }

    private getTasks(): Task[] {
        if (this.tasks !== undefined) {
            return this.tasks;
        }
        this.tasks = [];
        return this.tasks;
    }

    private getTask(flavor: string, flags: string[], definition?: IExportJarTaskDefinition): Task | undefined {
        if (definition === undefined) {
            return undefined;
        }
        return new Task(definition, TaskScope.Workspace, `${flavor} ${flags.join(" ")}`,
            ExportJarTaskProvider.exportJarType, new CustomExecution(async (): Promise<Pseudoterminal> => {
                // When the task is executed, this callback will run. Here, we setup for running the task.
                return new ExportJarTaskTerminal();
            }));
    }

}

interface IExportJarTaskDefinition extends TaskDefinition {
    name: string;
    filesignore?: string[];
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
