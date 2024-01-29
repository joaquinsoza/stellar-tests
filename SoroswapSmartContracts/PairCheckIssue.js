// Should try to create a pair directly to the factory contract and see what happens if the addresses given are the same
// Then test again with different addresses 
// Maybe check the rust tests? 

var StellarSdk = require('@stellar/stellar-sdk');

let network = process.argv[2] || undefined;
let server = new StellarSdk.Horizon.Server("http://stellar:8000", { allowHttp: true });
let friendbot = "http://stellar:8000/friendbot?addr="
let passphrase = "Standalone Network ; February 2017"

const freighterWallet = {
  public: "GDTRLSZ6AFVCLPGB2TRRPE5YIHFSUVSLBHW6SJQQADZ7JQADOYFBMFBZ",
  secret: "SAGELCTURYBOCWGFXM2PGUPWNEHZHI435ZKBVMCEKSPJZL2EINRZYPAI"
}

const adminWallet = {
  public: "GAYIZTTI7QKLRKA5GXH5OFFCW3QLU4LNSN5N3XIYXB4P56HHBIXC73X6",
  secret: "SCLPVGNVME5OJKOMPRPKDQSMKWC52RLK63T5IGMMCA52KL64WDK3MZZD"
}

switch (network) {
  case 'standalone':
    server = new StellarSdk.Horizon.Server("http://stellar:8000", { allowHttp: true });
    friendbot = `http://stellar:8000/friendbot?addr=`;
    passphrase = "Standalone Network ; February 2017";
    break;
  
  case 'futurenet':
    server = new StellarSdk.Horizon.Server("https://horizon-futurenet.stellar.org");
    friendbot = `https://friendbot-futurenet.stellar.org?addr=`;
    passphrase = "Test SDF Future Network ; October 2022";
    break;

  case 'testnet':
    server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
    friendbot = `https://friendbot.stellar.org?addr=`;
    passphrase = "Test SDF Network ; September 2015";
    break;
  
  default:
    break;
}

async function createTxBuilder(source) {
  try {
    const account = await server.loadAccount(source.publicKey());
    return new StellarSdk.TransactionBuilder(account, {
      fee: '10000',
      timebounds: { minTime: 0, maxTime: 0 },
      networkPassphrase: passphrase,
    });
  } catch (e) {
    console.error(e);
    throw Error('unable to create txBuilder');
  }
}

async function invokeClassicOp(operation, source) {
  console.log('invoking classic op...');
  const txBuilder = await createTxBuilder(source);
  txBuilder.addOperation(operation);
  const tx = txBuilder.build();
  tx.sign(source);
  try {
    let response = await server.submitTransaction(tx);
    console.log(response)
    let status = response.status;
    const tx_hash = response.hash;
    console.log(`Hash: ${tx_hash}\n`);
    // Poll this until the status is not "NOT_FOUND"
    while (status === 'PENDING' || status === 'NOT_FOUND') {
      // See if the transaction is complete
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('checking tx...');
      response = await server.getTransaction(tx_hash);
      status = response.status;
    }
    console.log('Transaction status:', response.status);
    if (status === 'ERROR') {
      console.log(response);
    }
  } catch (e) {
    console.error(e);
    throw Error('failed to submit classic op TX');
  }
}

async function classic_trustline(user, asset) {
  const operation = StellarSdk.Operation.changeTrust({
    source: user.publicKey(),
    asset: asset,
  });
  await invokeClassicOp(operation, user);
}

async function classic_mint(user, asset, amount, source) {
  const operation = StellarSdk.Operation.payment({
    amount: amount,
    asset: asset,
    destination: user.publicKey(),
    source: source.publicKey(),
  });
  await invokeClassicOp(operation, source);
}

async function main() {
  const userKeyPair = StellarSdk.Keypair.fromSecret(freighterWallet.secret)
  const adminKeyPair = StellarSdk.Keypair.fromSecret(adminWallet.secret)
  
  const asset = new StellarSdk.Asset("ROGP", "GAYIZTTI7QKLRKA5GXH5OFFCW3QLU4LNSN5N3XIYXB4P56HHBIXC73X6")

  console.log(await classic_trustline(userKeyPair, asset))
  console.log(await classic_mint(userKeyPair, asset, "1000", adminKeyPair))
}

if (network == 'standalone' | network == 'futurenet' | network == 'testnet') {
  main()
} else {
  console.log("Args missing, usage:")
  console.log("node issueStellarAssets.js <NETWORK> [<AMOUNT OF TOKENS>]")
  console.log("<NETWORK> options: 'standalone', 'futurenet', 'testnet'")
}