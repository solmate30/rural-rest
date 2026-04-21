/**
 * RichTextEditor — Tiptap 기반 리치 텍스트 에디터
 * 숙소 설명 입력에 사용. HTML 문자열로 값을 관리한다.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "~/lib/utils";

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const TOOLBAR_BTN = "p-1.5 rounded-lg text-stone-500 hover:text-[#4a3b2c] hover:bg-stone-100 transition-colors disabled:opacity-40";

export function RichTextEditor({ value, onChange, placeholder, className, disabled }: Props) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: placeholder ?? "내용을 입력하세요..." }),
        ],
        content: value,         // 초기값만 사용 — 이후 외부 value 변경은 무시
        editable: !disabled,
        onUpdate({ editor }) {
            // 빈 문서면 빈 문자열 반환
            const html = editor.isEmpty ? "" : editor.getHTML();
            onChange(html);
        },
    }, []);                     // deps 빈 배열 → 마운트 시 1회만 초기화

    if (!editor) return null;

    return (
        <div className={cn("rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-primary/30 overflow-hidden", className)}>
            {/* 툴바 */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-input bg-stone-50">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(TOOLBAR_BTN, editor.isActive("bold") && "bg-stone-200 text-[#4a3b2c]")}
                    title="굵게"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">format_bold</span>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(TOOLBAR_BTN, editor.isActive("italic") && "bg-stone-200 text-[#4a3b2c]")}
                    title="기울임"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">format_italic</span>
                </button>
                <div className="w-px h-4 bg-stone-200 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(TOOLBAR_BTN, editor.isActive("bulletList") && "bg-stone-200 text-[#4a3b2c]")}
                    title="목록"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(TOOLBAR_BTN, editor.isActive("orderedList") && "bg-stone-200 text-[#4a3b2c]")}
                    title="번호 목록"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                </button>
                <div className="w-px h-4 bg-stone-200 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={cn(TOOLBAR_BTN, editor.isActive("blockquote") && "bg-stone-200 text-[#4a3b2c]")}
                    title="인용"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">format_quote</span>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className={TOOLBAR_BTN}
                    title="구분선"
                    disabled={disabled}
                >
                    <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
                </button>
            </div>

            {/* 에디터 본문 */}
            <EditorContent
                editor={editor}
                className="px-4 py-3 text-sm text-[#4a3b2c] min-h-[140px] [&_.tiptap]:outline-none [&_.tiptap_p]:my-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-stone-300 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:text-stone-500 [&_.tiptap_hr]:border-stone-200 [&_.tiptap_hr]:my-2 [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:text-stone-400 [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none"
            />
        </div>
    );
}
