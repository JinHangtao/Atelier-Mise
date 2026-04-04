// ════════════════════════════════════════════════════════════
// CanvasArea.tsx — 需要做的 2 处 str_replace
// ════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────
// 【改动 A】顶部 import 区域
// 把这一行：
//   import { Aspect } from './types'
// 替换成：
// ──────────────────────────────────────────────────────────

import { Aspect, EmojiBlock as EmojiBlockType, ArrowDirection, SelectedEmojiId } from './types'
import EmojiBlockComponent from './EmojiBlock'
import EmojiPickerPanel from './EmojiPickerPanel'


// ──────────────────────────────────────────────────────────
// 【改动 B】blocks.map 渲染之后（1780行附近）
// 把这段：
//                     })}
//                   </div>
//                 </div>
//               </div>
//             )
//           })}
// 替换成：
// ──────────────────────────────────────────────────────────

                    })}

                    {/* ── Emoji Blocks Layer ────────────────────────────── */}
                    {((s as any).emojiBlocks as EmojiBlockType[] ?? [])
                      .filter((eb: EmojiBlockType) => eb.pageId === page.id)
                      .map((eb: EmojiBlockType) => (
                        <EmojiBlockComponent
                          key={eb.id}
                          block={eb}
                          selected={(s as any).selectedEmojiId === eb.id}
                          canvasScale={canvasZoom}
                          onSelect={(id: string) => {
                            ;(s as any).setSelectedEmojiId(id)
                            setSelectedBlockId(null)
                            setEditingBlockId(null)
                          }}
                          onDeselect={() => (s as any).setSelectedEmojiId(null)}
                          onMove={(id: string, x: number, y: number) =>
                            (s as any).setEmojiBlocks((prev: EmojiBlockType[]) =>
                              prev.map((b: EmojiBlockType) => b.id === id ? { ...b, x, y } : b)
                            )
                          }
                          onArrowClick={(fromId: string, direction: ArrowDirection, anchorX: number, anchorY: number) => {
                            ;(s as any).openEmojiFromArrow(anchorX, anchorY, fromId, direction)
                          }}
                        />
                      ))
                    }
                  </div>
                </div>
              </div>
            )
          })}

// ──────────────────────────────────────────────────────────
// 【改动 C】在 return 最后的 </main> 前插入 picker panel
// 把：
//     </main>
// 替换成：
// ──────────────────────────────────────────────────────────

      {/* ── Emoji Picker Panel (portal 级, fixed 定位) ── */}
      <EmojiPickerPanel
        state={(s as any).emojiPickerState}
        onSelect={(s as any).handleEmojiSelect}
        onClose={(s as any).closeEmojiPicker}
      />
    </main>

// ──────────────────────────────────────────────────────────
// 【改动 D】page 容器 onClick 里加 emoji 取消选中
// 找到这行（约1093行）：
//   setActivePageId(page.id); setEditingBlockId(null); setSelectedBlockId(null); setFontPickerOpen(false); setColorPickerOpen(false)
// 在末尾加：
//   ;(s as any).setSelectedEmojiId?.(null)
// ──────────────────────────────────────────────────────────
