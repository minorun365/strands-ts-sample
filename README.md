# strands-ts-sample

Strands Agents SDK の TypeScript 版を Vercel で動かす最小サンプルです。Vercel の関数（api/agent.ts）でエージェントを動かし、Tavily のWeb検索をツールとして持たせています。モデルは Amazon Bedrock の Claude Haiku 4.5 で、画面は React + Vite です。

## 動かし方

.env.example を .env に写して、Tavily の APIキーと AWS の認証情報を入れます。Vercel に載せる場合は、同じ値を Vercel の環境変数に設定します。

```bash
npm install
npx vercel dev
```

npm run dev では画面しか立ち上がらず、エージェントの関数は動きません。手元で試すときは vercel dev を使います。

## 公開するときの注意

Vercelへデプロイした本番のURLは、そのままでは誰でも開けます。URLを知った人が、みなさんのAWSとTavilyの料金でエージェントを動かせてしまうため、次の対応をおすすめします。

- Vercelのプロジェクトの「Settings」→「Deployment Protection」で「Vercel Authentication」を有効にし、範囲を「All Deployments」にする（既定の「Standard Protection」は本番のドメインを保護しません）
- 環境変数に入れるIAMユーザーの権限は、Bedrockのモデル呼び出しだけに絞る（`bedrock:InvokeModel` と `bedrock:InvokeModelWithResponseStream`）
- 試し終えたら、プロジェクトを削除し、アクセスキーを無効化・削除する

## ライセンス

MIT Licenseです。詳細は [LICENSE](./LICENSE) を参照してください。
