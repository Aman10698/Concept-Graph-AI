const mongoose = require('mongoose');
const uri = 'mongodb://localhost:27017/conceptgraph';

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  console.log('Connected DB:', db.databaseName);
  
  const cols = await db.listCollections().toArray();
  console.log('\nAll collections:');
  cols.forEach(c => console.log('  -', c.name));

  const ragCount = await db.collection('ragdocuments').countDocuments();
  const rawCount = await db.collection('ragrawdocuments').countDocuments();
  console.log('\nragdocuments count    :', ragCount);
  console.log('ragrawdocuments count :', rawCount);

  if (rawCount > 0) {
    const docs = await db.collection('ragrawdocuments').find({}).toArray();
    console.log('\nragrawdocuments contents:');
    docs.forEach(d => {
      console.log('  filename :', d.filename);
      console.log('  pageCount:', d.pageCount);
      console.log('  textLen  :', (d.fullText || '').length);
      console.log('  preview  :', (d.fullText || '').slice(0, 100).replace(/\n/g, ' '));
      console.log('');
    });
  } else {
    console.log('\n⚠️  ragrawdocuments is EMPTY');
    console.log('This means saveRawDocument() is not being called during upload.');
    console.log('The collection exists in MongoDB but has no documents yet.');
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
