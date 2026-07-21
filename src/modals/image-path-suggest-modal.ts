import { type App, SuggestModal, type TAbstractFile, TFile, TFolder } from "obsidian";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"]);

function isImageFile(file: TFile): boolean {
    return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

export class ImagePathSuggestModal extends SuggestModal<TAbstractFile> {
    private readonly onSubmit: (imagePath: string) => void;

    constructor(app: App, onSubmit: (imagePath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder("https://example.com/image.jpg OR path/to/image.jpg");
    }

    getSuggestions(query: string): TAbstractFile[] {
        const normalizedQuery = query.trim().replace(/^\/+/, "");
        if (normalizedQuery === "") {
            return [];
        }
        if (
            normalizedQuery.startsWith("http://") ||
            normalizedQuery.startsWith("https://") ||
            normalizedQuery.startsWith("www.")
        ) {
            return [];
        }

        const separatorIndex = normalizedQuery.lastIndexOf("/");
        const folderPath = separatorIndex >= 0 ? normalizedQuery.slice(0, separatorIndex) : "";
        const nameQuery = normalizedQuery.slice(separatorIndex + 1).toLowerCase();
        const folder = folderPath === "" ? this.app.vault.getRoot() : this.app.vault.getFolderByPath(folderPath);
        if (!folder) return [];

        return folder.children
            .filter((entry) => entry instanceof TFolder || (entry instanceof TFile && isImageFile(entry)))
            .filter((entry) => entry.name.toLowerCase().includes(nameQuery))
            .sort((left, right) => {
                const folderOrder = Number(right instanceof TFolder) - Number(left instanceof TFolder);
                return folderOrder || left.path.localeCompare(right.path);
            })
            .slice(0, 10);
    }

    renderSuggestion(entry: TAbstractFile, el: HTMLElement): void {
        const container = el.createDiv({ cls: "dtb-suggestion" });
        const icon = container.createSpan();
        icon.textContent = entry instanceof TFolder ? "📁" : "🖼️";
        const text = container.createSpan();
        text.textContent = entry.path;
    }

    selectSuggestion(entry: TAbstractFile, evt: MouseEvent | KeyboardEvent): void {
        if (entry instanceof TFolder) {
            this.inputEl.value = `${entry.path}/`;
            this.inputEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
            this.inputEl.focus();
            return;
        }
        super.selectSuggestion(entry, evt);
    }

    onChooseSuggestion(entry: TAbstractFile, _evt: MouseEvent | KeyboardEvent): void {
        if (entry instanceof TFile && isImageFile(entry)) {
            this.onSubmit(entry.path);
        }
    }
}
