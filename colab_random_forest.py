from google.colab import files
import io, json, zipfile, re
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, ConfusionMatrixDisplay, accuracy_score
import joblib

# Upload ONLY clean.csv, clutter.csv and weak_signal.csv (no backups).
raw_uploaded = files.upload()
uploaded = {}
for filename, content in raw_uploaded.items():
    canonical = re.sub(r" \(\d+\)(?=\.csv$)", "", filename, flags=re.IGNORECASE).lower()
    if canonical in uploaded:
        raise ValueError('Select only one copy of each class CSV: ' + canonical)
    uploaded[canonical] = content
CLASSES = ['clean', 'clutter', 'weak_signal']
FEATURES = ['valid_fraction', 'distance_mean', 'distance_std', 'distance_min',
            'distance_max', 'distance_median', 'distance_iqr', 'session_range', 'stable_jump_cm']

def features(distance, valid):
    distance, valid = np.asarray(distance, dtype=float), np.asarray(valid, dtype=int)
    d = distance[valid == 1]
    jump = 0.
    for i in range(10, len(distance)):
        if valid[i] == 1 and np.all(valid[i-10:i] == 1):
            plateau = distance[i-10:i]
            if np.ptp(plateau) <= 1 + 1e-8:
                jump = max(jump, abs(distance[i] - plateau.mean()))
    if len(d) == 0:
        return np.zeros(9)
    return np.array([len(d)/len(distance), d.mean(), d.std(), d.min(), d.max(),
                     np.median(d), np.percentile(d,75)-np.percentile(d,25), np.ptp(d), jump])

def training_label(x):
    if x[0] == 0: return 'weak_signal'
    if x[7] < 1: return 'clean'
    if x[7] < 10: return 'clutter'
    return 'weak_signal'

samples = []
for name in ['clean.csv', 'clutter.csv', 'weak_signal.csv']:
    if name not in uploaded:
        raise ValueError('Upload all three original CSV files. Missing: ' + name)
    df = pd.read_csv(io.BytesIO(uploaded[name]))
    required = ['session_id','reading_index','distance_cm','valid_echo','label']
    if not set(required).issubset(df.columns): raise ValueError('Missing columns: '+name)
    groups = list(df.groupby('session_id', sort=False))
    for order, (sid, rows) in enumerate(groups):
        rows = rows.sort_values('reading_index')
        if len(rows)!=30 or set(rows.reading_index)!=set(range(30)):
            raise ValueError(f'{name}: {sid} needs 30 unique readings indexed 0–29')
        if not np.isfinite(rows[['distance_cm','valid_echo']].to_numpy()).all():
            raise ValueError('Non-finite sensor values')
        if (rows.distance_cm < 0).any() or not rows.valid_echo.isin([0,1]).all():
            raise ValueError('Invalid sensor values')
        x = features(rows.distance_cm, rows.valid_echo)
        samples.append(dict(id=str(sid), original_label=str(rows.label.iloc[0]),
                            label=training_label(x), x=x,
                            partition='train' if order < len(groups)//2 else 'test'))

# Same 400 training-pattern examples as the website. Never include these in test scores.
generated = []
for i in range(100):
    level = 15+i*2.5
    ranges = [[0,.1,.5,.9,.9999][i%5], [1,1.0001,2,5,9,9.9999][i%6]]
    for span in ranges:
        d = level+(np.arange(30)%2)*span
        x = features(d,np.ones(30))
        generated.append((x,training_label(x)))
    d = level+(np.arange(30)>=15)*[10,10.0001,11,20,50,200][i%6]
    x = features(d,np.ones(30)); generated.append((x,training_label(x)))
    d = level+(np.arange(30)%2)*(11+i*2); v = np.ones(30)
    if i%3==0: d[5]=0; v[5]=0
    if i%10==0: d[:]=0; v[:]=0
    x = features(d,v); generated.append((x,training_label(x)))

train = [s for s in samples if s['partition']=='train']
test = [s for s in samples if s['partition']=='test']
X_train = np.array([s['x'] for s in train]+[x for x,y in generated])
y_train = [s['label'] for s in train]+[y for x,y in generated]
X_test = np.array([s['x'] for s in test]); y_test = [s['label'] for s in test]
model = RandomForestClassifier(n_estimators=10, max_depth=7, min_samples_leaf=2,
                               max_features='sqrt', class_weight='balanced', random_state=42)
model.fit(X_train,y_train)
predicted = model.predict(X_test)
print('Trees:', len(model.estimators_))
print('Recorded training sessions:', len(train), '| Generated training examples:', len(generated))
print('Recorded test sessions:', len(test))
print('\nRecorded session labels:')
print(pd.crosstab(pd.Series([s['original_label'] for s in samples],name='Collected condition'),
                  pd.Series([s['label'] for s in samples],name='Range-derived target')))
print('\nHeld-out agreement with range-derived labels:', f'{accuracy_score(y_test,predicted):.1%}')
print(classification_report(y_test,predicted,labels=CLASSES,zero_division=0))
print('This score measures agreement with the distance rules, not independently verified physical echo quality.')
print('Missing test classes have untested performance. Separate recording runs are needed for stronger validation.')
fig, ax = plt.subplots(figsize=(8, 7))
ConfusionMatrixDisplay.from_predictions(
    y_test, predicted, labels=CLASSES,
    display_labels=['Clean', 'Clutter', 'Weak signal'],
    cmap='YlGn', colorbar=True, values_format='d', ax=ax,
    text_kw={'fontsize': 18, 'fontweight': 'bold'})
ax.set_xlabel('Predicted class', fontsize=13, labelpad=12)
ax.set_ylabel('Actual range-derived class', fontsize=13, labelpad=12)
ax.set_title('Confusion matrix — recorded test sessions', fontsize=15, pad=18)
ax.tick_params(labelsize=12)
counts = {label: y_test.count(label) for label in CLASSES}
missing = [label.replace('_',' ') for label, count in counts.items() if count == 0]
fig.text(.5, .02, 'Each cell is a session count; zeros are shown.\n' +
         ('No test sessions for: ' + ', '.join(missing) if missing else 'All three classes are represented.'),
         ha='center', fontsize=10)
fig.tight_layout(rect=[0,.08,1,1])
plt.savefig('confusion_matrix.png',dpi=200); plt.show()
pd.Series(model.feature_importances_,index=FEATURES).sort_values().plot.barh(color='#64734c')
plt.title('Random Forest feature importance'); plt.tight_layout()
plt.savefig('feature_importance.png',dpi=160); plt.show()
joblib.dump({'model':model,'features':FEATURES,'classes':CLASSES},'random_forest_10_trees.joblib')
pd.DataFrame([{'session_id':s['id'],'original_label':s['original_label'],'target':s['label'],
               'prediction':p} for s,p in zip(test,predicted)]).to_csv('test_predictions.csv',index=False)
with zipfile.ZipFile('colab_results.zip','w') as z:
    for name in ['random_forest_10_trees.joblib','test_predictions.csv','confusion_matrix.png','feature_importance.png']:
        z.write(name)
files.download('colab_results.zip')
