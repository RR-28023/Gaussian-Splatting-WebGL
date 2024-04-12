import os
import mlflow
from pathlib import Path
import argparse
import shutil
import pandas as pd
import json

MLFLOW_URL = 'https://trn001-konstellation-mlflow.kdl-dell.konstellation.io'
os.environ['MLFLOW_S3_ENDPOINT_URL'] = 'https://minio.kdl-dell.konstellation.io'

mlflow.set_tracking_uri(MLFLOW_URL)

def experiment_exists(experiment_id):
    return mlflow.get_experiment(experiment_id)

def create_metadata(is_dynamic):
    data = {
        "isDynamic": "true" if is_dynamic else "false",
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

def last_downloaded_frame(model_destination: Path):
    "check existing directory to avoid re-downloading frames"
    starting_frame = 0
    for file in model_destination.iterdir():
        if file.suffix == '.ply':
            frame = int(file.stem)
            starting_frame = max(starting_frame, frame)

    return starting_frame +1

def get_runs(parent_id, experiment_id) -> pd.DataFrame:
    experiment_exists(experiment_id)
    # Load experiment runs
    runs = mlflow.search_runs(experiment_ids=[experiment_id])
    runs = runs[(runs['run_id'].str.contains(parent_id)) | (runs['tags.mlflow.parentRunId'] == parent_id)]
 
    # Check if there are any runs
    assert not runs.empty, f"No runs found for parent run {parent_id}"

    return runs

def download_dynamic_artifacts(frames_run, model_destination):

    # Create the model destination folder
    model_destination = Path('../models') / model_destination 
    print(f"Downloading frames to {model_destination}")
    model_destination.mkdir(exist_ok=True)

    # If the folder already exists, we need to check the last frame downloaded
    starting_frame = last_downloaded_frame(model_destination)
    print(f"Starting from frame {starting_frame}")

    # Sort the runs by frame number and discard the ones already downloaded
    frames_run = frames_run.sort_values(by=['tags.mlflow.runName'])
    frames_run = frames_run.iloc[starting_frame:]

    for _, run in frames_run.iterrows():
        print(run)
        run_id = run['run_id']
        
        # Download the point cloud
        try:
            temp_dir = mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path='point_cloud', dst_path='temp_dir')
        except Exception as e:
            print(f"Failed to download run {run_id}")
            print(e)
            continue

        # Find the last training iteration and save as final point cloud
        iteration = [int(iteration_folder.stem.split('_')[-1]) for iteration_folder in Path(temp_dir).iterdir()]
        max_iteration = max(iteration)
        print(f"Downloaded run {run_id} with {max_iteration} iterations")
        original_file = Path(temp_dir) / f'iteration_{max_iteration}' / 'point_cloud.ply'
        frame_name = int(run['tags.mlflow.runName'].split('_')[-1])
        ply_path = model_destination / f'{frame_name:05d}.ply'
        original_file.rename(ply_path)

        # Create metadata file
        metadata = create_metadata(is_dynamic=True)
        metadata_path = model_destination / f'{model_destination.name}.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)

    shutil.rmtree('temp_dir')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download experiments from MLFlow')
    parser.add_argument('--experiment_id', type=str, help='Experiment id')
    parser.add_argument('--parent_id', type=str, help='Parent run id')
    parser.add_argument('--model_destination', type=str, help='Destination folder for the models', default='new_model')
    args = parser.parse_args()
    parent_id = args.parent_id
    experiment_id = args.experiment_id
    model_destination = args.model_destination

    runs = get_runs(parent_id, experiment_id)
    if len(runs) > 1:
        download_dynamic_artifacts(runs, model_destination)
    else:
        # TODO: download_static_artifacts(runs, model_destination)
        pass