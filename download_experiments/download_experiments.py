import os
import mlflow
from pathlib import Path
import argparse
import shutil
import pandas as pd
import json
import re
MLFLOW_URL = 'https://trn001-konstellation-mlflow.kdl-dell.konstellation.io'
os.environ['MLFLOW_S3_ENDPOINT_URL'] = 'https://minio.kdl-dell.konstellation.io'

mlflow.set_tracking_uri(MLFLOW_URL)


def create_metadata_json(is_dynamic:bool)->dict:
    """create basic information of model
    center point, up and so on are default values and need to be updated

    Args:
        is_dynamic (bool): Whether the model is dynamic or not

    """
    data = {
        "isDynamic": True if is_dynamic else False,
        "up": [
            0.0,
            0.0,
            -0.9999999
        ],
        "backgroundColorHEX": "#FFFFFF",
        "target": [
            0.802,
            -1.531,
            1.43265
        ],
        "defaultCameraMode": "orbit",
        "size": "?",
        "camera": [
            0.0,
            1.8,
            7
        ],
        "min_phi": 1.0,
        "max_phi": 6.0,
        "min_radius": 2
    }
    return data

def create_meta_data_files(model_directory:Path, is_dynamic:bool):
    """Generate the necessary metadata files for the model

    Args:
        model_directory (Path): directory where the model is stored
        is_dynamic (bool): if the model is dynamic or static
    """
    # Create metadata file
    metadata = create_metadata_json(is_dynamic)
    metadata_path = model_directory / f'{model_directory.name}.json'
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f)
    
    # Add model to list if it does not exist already
    with open('../models/models.js', 'r') as f:
        models_to_load = f.read()
    if model_directory.name not in models_to_load:
        models_to_load = models_to_load.replace('\n};', f",\n    {model_directory.name}" + ":{}\n};")
        with open('../models/models.js', 'w') as f:
            f.write(models_to_load)

def get_runs(parent_id:str, experiment_id:str) -> pd.DataFrame:
    """download runs from mlflow and stored them in a pandas dataframe
    if run has already been download (ie model is already in the model directory) it will be skipped

    Args:
        parent_id (str): id of parent run (or id of the run to download if static)
        experiment_id (str): id of experiment

    Returns:
        pd.DataFrame: dataframe with the list of runs
    """
    try:
        mlflow.get_experiment(experiment_id)
    except mlflow.exceptions.RestException as e:
        print(e)
        print(f'Verify experiment and run id. In th url of the run you should be able to find:')
        print('\t/experiments/EXPERIMENT_ID/runs/PARENT_ID')
        exit()

    # Load experiment runs
    runs = mlflow.search_runs(experiment_ids=[experiment_id])
    try:
        runs = runs[(runs['run_id'].str.contains(parent_id)) | (runs['tags.mlflow.parentRunId'] == parent_id)]
        parent_name = runs[(runs['run_id'].str.contains(parent_id))].iloc[0]['tags.mlflow.runName']
        runs.loc[(runs['run_id'].str.contains(parent_id)), 'tags.mlflow.runName'] = 'frame_0000' # modify parent name to be a frame
        print('Parent run found', runs[(runs['run_id'].str.contains(parent_id))].iloc[0])
    except KeyError:
        print('No parent run id found, using parent id as run id')
        runs = runs[(runs['run_id'].str.contains(parent_id))]
        parent_name = runs[(runs['run_id'].str.contains(parent_id))].iloc[0]['tags.mlflow.runName']

    # Check if there are any runs
    assert not runs.empty, f"No runs found for parent run {parent_id}"

    # Drop runs already downloaded
    model_destination = Path('../models') / parent_name.replace('-', '_')
    if model_destination.exists():
        runs = runs[~runs['tags.mlflow.runName'].isin([file.stem for file in model_destination.iterdir() if file.suffix == '.ply'])]
        print(len(runs), 'runs to download')
    return runs, model_destination


def move_artifacts_to_destination(temp_dir:Path, model_destination:Path, file_name:str):
    """Move artifacts of the last iteration from temp_dir to the model destination

    Args:
        temp_dir (Path): current location of the artifacts
        model_destination (Path): final destination of the artifacts
        file_name (str): name to give to the final artifact
    """
    directories = [(int(re.findall(r'\d+',iteration.name)[-1]), iteration) for iteration in temp_dir.iterdir()]
    max_iteration, max_iteration_directory = sorted(directories)[-1]
    original_file_name = [file for file in max_iteration_directory.iterdir() if '.ply' in file.name][0]
    print(f'preserving iteration {max_iteration}')
    ply_path = model_destination / file_name
    original_file_name.rename(ply_path)

def donwload_artifacts(runs:pd.DataFrame, model_destination:Path, artifact_path:str):
    """iterate through the runs to download artifacts
    then select the artifact of last iteration per run and move it to the model destination

    Args:
        runs (pd.DataFrame): list of runs to download
        model_destination (Path): final destination of the .ply files
        artifact_path (str): within mlflow artifact path to download (eg 'point_cloud' or 'net')
    """
    for _, run in runs.iterrows():
        run_id = run['run_id']
        run_name = run['tags.mlflow.runName']
        print(f"Downloading run {run_id}: {run_name}")
        # Download the artifacts
        try:
            temp_dir = mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path=artifact_path, dst_path='temp_dir')
        except Exception as e:
            print(f"Failed to download run {run_id}")
            print(e)
            continue

        # Find the last training iteration and save as final point cloud
        move_artifacts_to_destination(Path(temp_dir), model_destination, run_name + '.ply')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download experiments from MLFlow')
    parser.add_argument('--experiment_id', type=str, help='Experiment id')
    parser.add_argument('--parent_id', type=str, help='Parent run id')
    args = parser.parse_args()
    parent_id = args.parent_id
    experiment_id = args.experiment_id

    runs, model_destination = get_runs(parent_id, experiment_id)
    model_destination.mkdir(exist_ok=True)

    if len(runs) > 1:
        donwload_artifacts(runs, model_destination, 'point_cloud')
        create_meta_data_files(model_destination, is_dynamic=True)
    else:
        donwload_artifacts(runs, model_destination, 'net')
        create_meta_data_files(model_destination, is_dynamic=False)

    if Path('temp_dir').exists():
        shutil.rmtree('temp_dir')
    print('Done')