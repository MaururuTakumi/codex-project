# codex-project

`codex-project` は、Codex App の同じプロジェクトフォルダで作った複数チャットに、共通の記憶領域を持たせるためのツールです。

Codex App では、1つのプロジェクトフォルダから複数のチャットを作れます。ただし、別チャットの会話内容が自動で共有されるわけではありません。`codex-project` は、その隙間を `.local/`、`AGENTS.md`、暗号化メモ、project-local hooks、プロジェクト内学習メモで補います。

ユーザーが直接使うのは、基本的に最初の1回だけです。その後の `context`、`memory`、`secret`、`learn`、`hooks` などの補助コマンドは、主に Codex が `AGENTS.md` と hooks に従って使います。

既存のソースコードやドキュメントを消さずに、共有記憶のためのファイルだけを追加します。

## インストール

必要なのは Node.js 20 以上です。GitHub のURLからCLIとCodex App用スキルを入れられます。

```sh
npm install --global https://github.com/MaururuTakumi/codex-project.git \
  && codex-project install-skill
```

`npm install --global` で `codex-project` コマンドを使えるようにします。`codex-project install-skill` で Codex App の `/` 一覧から `Codex Project` を選べるようにします。同じコマンドを再実行すれば更新できます。

開発用にcloneする場合:

```sh
git clone https://github.com/MaururuTakumi/codex-project.git
cd codex-project
npm link
codex-project install-skill
```

## 他のProjectで有効にする

各Projectにつき最初の1回だけ、Codex Appの入力欄で `/` から `Codex Project` を選びます。

ターミナルなら、そのProject内で以下を実行します。

```sh
codex-project init
```

旧版を導入済みのProjectでも、更新後にもう一度 `codex-project init` を実行してください。既存の `.local/` を維持したまま、Project UUID、共有メモリ、AGENTS.mdの管理ブロック、project-local hooksを更新します。

## ユーザーが使うもの

対象プロジェクトのフォルダで、最初に1回だけ実行します。

```sh
codex-project init
```

初期情報を一緒に渡すこともできます。

```sh
codex-project init "Next.js の SaaS。認証は Clerk。"
```

Codex App では、入力欄で `/` を打って `Codex Project` を選びます。手入力で明示する場合は `$codex-project` も使えます。

```text
$codex-project
$codex-project Next.js の SaaS。認証は Clerk。
```

ここでの `init` は「共有記憶を追加セットアップする」という意味です。既存のソースコードやドキュメントは変更しません。すでに開発中のプロジェクトにもあとから導入できます。

`.local/` がすでに git で追跡されている場合だけ、安全のため停止します。

## 追加されるもの

- `.local/project.md`: プロジェクトの目的や初期情報
- `.local/project.json`: pathを移動しても変わらないProject UUID
- `.local/state.md`: 現在の状態
- `.local/decisions.md`: 決定事項
- `.local/index.md`: チャット一覧
- `.local/chats/<chat-id>/`: チャットごとの作業ログ
- `.local/learn/`: ユーザー指示、ミス、好み、再利用できる注意点の候補
- `.local/memory/records/`: 出典と状態を持つ、検索可能な構造化Project memory
- `.local/vault/secrets.json.enc`: 暗号化された保存領域
- `.codex/config.toml`: project-local hooks を有効にする設定
- `.codex/hooks.json`: このプロジェクト専用の hook 設定
- `.codex/hooks/codex-project-context-hook.mjs`: 各ターン前に共有状態を短く表示する hook
- `AGENTS.md`: 後続チャットが共有記憶を扱うためのルール

`.local/` は `.gitignore` に追加されます。個人情報や秘密情報が入る前提なので、リポジトリには入れません。

## Codex が使うもの

以下のコマンドは、ユーザーが普段直接使うためのものではありません。Codex が後続チャットで共有状態を読む、必要な暗号化メモだけを取り出す、ユーザーの訂正や再利用できる注意を学習候補にする、project-local hooks を動かす、といった用途で使います。

```sh
codex-project context
codex-project context --hook
codex-project learn add <instruction|mistake|preference|rule> <text>
codex-project learn capture
codex-project memory get <name>
codex-project secret get <name>
codex-project hooks status
```

`context` は、平文の共有ファイル、暗号化メモ名、秘密値名、プロジェクト内学習メモを表示します。暗号化メモや秘密値の本文は表示しません。

`context --hook` は、各ターン前に hooks から呼ばれる短い表示用です。あわせて `learn capture --hook` が走り、チャットログや共有ファイルから「次にも効きそうな注意」を候補化します。

hookは現在の入力もローカル検索へ渡し、関連する構造化Project memoryだけを最大5件表示します。これは過去の参考情報として明示され、現在のユーザー指示や確認済みのローカル状態を上書きしません。通常はユーザーが毎回コマンドを実行する必要はありません。

`memory get` と `secret get` は本文や値を出力します。Codex は必要な処理だけに使い、チャット本文には表示しません。

## プロジェクト内学習メモ

Codex が同じプロジェクト内で同じミスを繰り返さないように、ユーザーの訂正、明示指示、好み、再利用できる注意点を `.local/learn/` に保存します。

これはユーザーが管理するものではなく、Codex が内部的に使う軽い記憶です。たとえば「README に未実装機能を既存機能のように書かない」「コピー用本文はクリップボードへ入れる」のような、他チャットにも効く学びを次の context に出します。

保存先は `.local/` 配下なので、このプロジェクトの外には広がりません。秘密値や個人情報の生データは学習メモにせず、必要なら暗号化メモか秘密値として扱います。

## 検索可能なProject memory

Codexは、ユーザーが明示した長く使える決定・Project fact・好み・教訓・一時的な作業状態だけを構造化して保存できます。正本は権限`0600`のJSONで、SQLite FTS5 indexはいつでも再構築できる派生データです。SQLiteが利用できなくても線形検索へfail-openします。Vector、Persona、Sceneの自動生成は行いません。

通常はCodexが必要に応じて操作します。確認や手動操作をしたい場合は次を使えます。

```sh
codex-project memory status
codex-project memory remember decision "採用した設計と理由"
codex-project memory search "検索語"
codex-project memory show <id>
codex-project memory why <id>
codex-project memory correct <id> "訂正後の内容"
codex-project memory forget <id>
codex-project memory pause
codex-project memory resume
codex-project memory rebuild
```

`correct`は旧recordを削除せず`superseded`にし、`forget`は`forgotten`にします。activeかつ期限内のrecordだけが検索・自動recall対象です。秘密、メールアドレス、電話番号などを検出した場合は保存を拒否するため、必要な非公開情報は従来の暗号化`memory set`または`secret set`を使います。

`memory set|get|list|delete|import`は従来どおり暗号化メモ用です。構造化Project memoryは先頭のactionで判別するため、既存の暗号化メモ名との互換性も維持されます。

## 暗号化メモと秘密値

個人情報、パスワード、API キー、他チャットに共有したいが平文 Markdown には置きたくない内容は、内部的に暗号化して `.local/vault/secrets.json.enc` に保存します。

ユーザーは通常、鍵や保存形式を意識する必要はありません。チャットでユーザーが共有した秘密値や非公開メモは、Codex が必要に応じて `memory` や `secret` に保存します。平文の作業ログには、保存名や参照だけを残します。

必要な場合だけ、手動でも操作できます。普段はユーザーがこのコマンドを直接打つ前提ではありません。

```sh
printf '%s' 'ここに個人情報を含む共有メモ' | codex-project memory set account
codex-project memory list
codex-project memory get account
codex-project memory delete account
```

```sh
printf '%s' 'example-value' | codex-project secret set api_token
codex-project secret list
codex-project secret get api_token
codex-project secret delete api_token
```

既存ファイルを暗号化メモへ取り込む場合:

```sh
codex-project memory import account .local/account-credentials.md
```

取り込み後も元の平文ファイルは自動削除しません。内容を確認して、不要ならユーザーの明示指示で削除してください。

## project-local hooks

`codex-project init` は、対象プロジェクト内の `.codex/` にだけ hooks を入れます。`~/.codex/config.toml` には触らないので、別プロジェクトには広がりません。

hook は Codex の `UserPromptSubmit` で動き、各ターン前に共有状態とプロジェクト内学習メモを短く表示します。暗号化メモや秘密値の本文は表示しません。

hook の状態確認や再導入が必要な場合だけ、次を使います。

```sh
codex-project hooks status
codex-project hooks install
codex-project hooks remove
```

Codex が新しい hook を検出したときは、Codex 側の `/hooks` で信頼確認が必要になることがあります。

## 注意点

- `.local/` はローカル専用です。git に入れません。
- `.codex/` の hooks はこのプロジェクト専用です。
- 個人情報、パスワード、API キー、公開したくない共有メモをユーザーがチャットで伝えた場合、Codex が `memory` または `secret` に保存し、平文 Markdown には値そのものを書きません。
- 学習メモにも秘密値や個人情報の生データを入れません。
- 暗号化の鍵は内部管理されます。通常、ユーザーが意識する必要はありません。
- 暗号化は、`.local/` だけが流出した場合や誤コミットを防ぐためのものです。
- 同じ Mac の同じユーザー権限を完全に奪われた場合は、防御できません。
- 暗号化データは同じ環境で読む前提です。マシン移行時は別途エクスポートまたは移行が必要です。

## 開発

```sh
npm run check
npm test
```
