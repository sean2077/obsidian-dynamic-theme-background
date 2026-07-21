import { type App, SuggestModal, TFolder } from "obsidian";
import { t } from "../i18n";

export class ImageFolderSuggestModal extends SuggestModal<TFolder> {
    private readonly onSubmit: (folderPath: string) => void;

    constructor(app: App, onSubmit: (folderPath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder(t("folder_path_placeholder"));
    }

    getSuggestions(query: string): TFolder[] {
        const normalizedQuery = query.trim().replace(/^\/+/, "");
        if (normalizedQuery === "") return [];

        const separatorIndex = normalizedQuery.lastIndexOf("/");
        const parentPath = separatorIndex >= 0 ? normalizedQuery.slice(0, separatorIndex) : "";
        const nameQuery = normalizedQuery.slice(separatorIndex + 1).toLowerCase();
        const parent = parentPath === "" ? this.app.vault.getRoot() : this.app.vault.getFolderByPath(parentPath);
        if (!parent) return [];

        return parent.children
            .filter((entry): entry is TFolder => entry instanceof TFolder)
            .filter((folder) => folder.name.toLowerCase().includes(nameQuery))
            .sort((left, right) => left.path.localeCompare(right.path))
            .slice(0, 10);
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.createDiv({ text: folder.path });
    }

    onChooseSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
        this.onSubmit(folder.path);
    }
}
