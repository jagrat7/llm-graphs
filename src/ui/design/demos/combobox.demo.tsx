import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "#/ui/components/ui/combobox"

import { Row, Rows, type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Combobox", components: ["combobox"] }

const MODELS = ["GPT-5", "Claude Opus 4.5", "Gemini 3 Pro", "DeepSeek V3.2", "Grok 4"]

function Multiple() {
  const anchor = useComboboxAnchor()
  return (
    <Combobox items={MODELS} multiple defaultValue={MODELS.slice(0, 2)}>
      <ComboboxChips ref={anchor} className="w-80">
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((value) => (
                <ComboboxChip key={value}>{value}</ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder="Add a model" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No model matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export default function ComboboxDemo() {
  return (
    <Rows>
      <Row label="single">
        <Combobox items={MODELS}>
          <ComboboxInput placeholder="Search models" className="w-64" showClear />
          <ComboboxContent>
            <ComboboxEmpty>No model matches.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Row>
      <Row label="multiple">
        <Multiple />
      </Row>
    </Rows>
  )
}
