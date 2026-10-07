# 複数署名者による PDF 署名デモ（React + Apryse WebViewer）

売主（seller）と買主（buyer）が、1 つの PDF 契約書のそれぞれ自分の署名フィールドにだけ署名できるデモです。
バックエンドはなく、ユーザーと契約書は JSON、署名はブラウザの localStorage に保存します。

このデモの肝は次の 2 点です。

1. **ログインユーザーのロールから署名できるフィールドを判定し、それ以外の署名フィールドはすべて読み取り専用にする**
2. **そのロールの署名の XFDF だけを取り出して保存し、署名者ごとの署名を独立して管理する**

## ポイント 1：ロールによるフィールドの活性化

契約書ごとに、ロールと PDF の署名フィールド名を対応付けています（`src/data/agreements.json`）。

```json
"signatureFields": {
  "seller": "formSignature_p1_1",
  "buyer": "formSignature_p1_2"
}
```

ドキュメントの注釈が読み込まれると、`src/pages/AgreementViewPage.tsx` の `setupSignatureWidgets` が PDF 内の署名ウィジェットを順に調べ、フィールド名からどのロールのものかを判定します。

```ts
for (const annot of annotationManager.getAnnotationsList()) {
  if (!(annot instanceof Annotations.SignatureWidgetAnnotation)) continue;
  const role = ROLES.find((r) => signatureFields[r] === annot.getFieldName());
  if (!role) continue;
  widgets[role] = annot;
  if (role === myRole) {
    // 自分のフィールド：未署名の間は "Sign here" インジケーターを表示
    updateSignIndicator(instance, annot);
  } else {
    // 他のロールのフィールド：読み取り専用にし、インジケーターも出さない
    annot.fieldFlags.set(Annotations.WidgetFlags.READ_ONLY, true);
    annot.refresh();
    setSignIndicator(instance, annot, false);
  }
}
```

- **自分のロールのフィールド**：署名でき、署名するまで "Sign here" インジケーターが表示されます
- **他のロールのフィールド**：ウィジェットに `READ_ONLY` フラグが立つため、クリックも署名もできず、インジケーターも出ません
- **念のための対策**：`annotationChanged` のリスナーが、他のロールのフィールドに付いた署名を削除し、エラーメッセージを表示します

ロールとフィールドの対応はデータで持っているため、別の文書やロールを追加するときは `agreements.json`（と `Role` 型）を変更するだけでよく、ビューアの処理は変更不要です。

## ポイント 2：ロールの署名だけを XFDF で保存する

署名ツールをアノテーション署名モードにしているため、署名はウィジェットの外観に焼き込まれず、ウィジェットに関連付けられた独立したアノテーションとして作成されます。これにより、ロールごとの署名を個別に書き出せます。

```ts
signatureTool.setSigningMode(Tools.SignatureCreateTool.SigningModes.ANNOTATION);
```

「Confirm signature」を押すと、`confirmSignature` は自分のウィジェットに関連付けられた署名アノテーションだけを取り出し、ウィジェットやフォームフィールドを含めずに XFDF として書き出します。

```ts
const annot = widgets?.[myRole]?.getAssociatedSignatureAnnotation();
const xfdf = await annotationManager.exportAnnotations({
  annotationList: [annot],
  widgets: false,
  fields: false,
});
annotationManager.deleteAnnotation(annot, { force: true });
saveSignature(agreement.id, myRole, xfdf);
```

- **ロールごとに保存**：`saveSignature`（`src/lib/signatures.ts`）はロールごとのキー（`parallel-signature:signature:<agreementId>:<role>`）に XFDF を保存するため、一方の保存や取り消しが相手の署名を上書きすることはありません
- **最小限の XFDF**：`widgets` と `fields` を除外しているので、XFDF には PDF フォーム全体の状態ではなく署名そのものだけが含まれます
- **復元**：保存した各ロールの XFDF を `importAnnotations` で取り込むと、重なる署名ウィジェットに自動で関連付けられ、`ReadOnly` に設定されます。手描きの署名は削除し、この読み取り専用のコピーに置き換えます
- **結合**：両者の署名がそろうと「Download signed PDF」ですべての注釈を書き出し、`getFileData({ xfdfString, flatten: true })` でフラット化した PDF を出力します

## セットアップ

```sh
npm install   # postinstall で WebViewer のアセットを public/lib/webviewer にコピー
npm run dev
```

http://localhost:5173 を開き、以下でログインします（`src/data/users.json`）。

| ユーザー名 | パスワード | 役割 | 署名できるフィールド |
| --- | --- | --- | --- |
| `seller` | `seller` | 売主（THE VENDOR） | `formSignature_p1_1` |
| `buyer` | `buyer` | 買主（THE BANK） | `formSignature_p1_2` |

Apryse のライセンスキーは任意です。設定する場合は `.env.example` を `.env` にコピーして `VITE_APRYSE_LICENSE_KEY` を設定してください。

## 画面

| パス | 内容 |
| --- | --- |
| `/login` | ユーザー名・パスワードによる簡易ログイン |
| `/agreements` | 契約書一覧（役割ごとの署名状況、署名リセット） |
| `/agreements/:id` | 契約書ビューア。自分の役割の署名フィールドにのみ署名可能 |

## 署名の流れ

1. 契約書 PDF（`public/files/legal-contract_with-form-fields.pdf`）を読み込み、
   `src/data/agreements.json` の `signatureFields` で役割と署名フィールドを対応付けます
2. ログインユーザー以外の役割の署名フィールドは読み取り専用になり、署名できません
3. 自分のフィールドに署名して「Confirm signature」を押すと、その署名アノテーションだけを XFDF として保存します
4. 相手の署名は保存された XFDF を読み取り専用で重ねて表示します。両者の署名がそろうと
   フラット化した PDF をダウンロードできます

ログイン状態はタブごと（sessionStorage）、署名はブラウザ共通（localStorage）です。
2 つのタブで売主・買主それぞれにログインすると、相手の署名がリアルタイムに反映されます。

## 補足

- 認証・保存はデモ用の簡易実装です。本番利用はしないでください
